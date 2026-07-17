"""SwiftClaw main entry point."""

import asyncio
import os
import sys
from pathlib import Path

from loguru import logger
from telegram.error import Conflict

from config import get_settings
from config.settings import resolve_configured_path
from gateway.telegram import TelegramBotHandler

_startup_lock_file: object | None = None


def acquire_startup_lock() -> None:
    """Ensure only one SwiftClaw instance is running at a time."""
    global _startup_lock_file

    # Use project directory for lock file
    lock_path = Path(__file__).parent / ".swiftclaw.lock"

    # Platform-specific lock implementation
    if os.name == "nt":  # Windows
        import msvcrt

        try:
            lock_file = lock_path.open("w")
            # Try to lock the file exclusively (non-blocking)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        except (OSError, IOError) as exc:
            lock_file.close()
            raise RuntimeError(
                "Another SwiftClaw instance is already running. "
                "Stop the existing process before starting a new one."
            ) from exc

        # Re-lock as shared lock to keep it held
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
    else:  # Unix/Linux/Mac
        import fcntl

        lock_file = lock_path.open("w")

        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            lock_file.close()
            raise RuntimeError(
                "Another SwiftClaw instance is already running. "
                "Stop the existing process before starting a new one."
            ) from exc

    lock_file.write(str(os.getpid()))
    lock_file.flush()
    _startup_lock_file = lock_file


def prepare_runtime_environment() -> None:
    """Validate runtime prerequisites before starting the bot."""
    settings = get_settings()

    if os.name != "nt" and not (os.getenv("DISPLAY") or os.getenv("WAYLAND_DISPLAY")):
        logger.warning(
            "No desktop session detected. Telegram chat will still work, but "
            "visible browser windows are unavailable. Start SwiftClaw from "
            "scripts/start_visible_desktop.sh in a graphical terminal to see "
            "a real browser window."
        )

    if settings.file_work_dir:
        try:
            work_dir = resolve_configured_path(settings.file_work_dir)
            work_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"File work directory: {work_dir}")
        except Exception as e:
            logger.warning(f"File work directory not available: {e}")

    browser_target = settings.browser_executable_path or settings.browser_channel
    logger.info(f"Browser target: {browser_target or 'default Chromium'}")

    if settings.local_browser_proxy:
        logger.info(f"Local browser proxy: {settings.local_browser_proxy}")


def setup_logging() -> None:
    """Configure logging with loguru."""
    settings = get_settings()

    # Remove default handler
    logger.remove()

    # Add console handler with custom format
    logger.add(
        sys.stdout,
        level=settings.log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
               "<level>{message}</level>",
    )


async def run_telegram_bot() -> None:
    """Run Telegram bot in polling mode."""
    settings = get_settings()
    handler = TelegramBotHandler(settings=settings)
    application = handler.create_application()

    logger.info("Starting Telegram bot in polling mode...")

    await application.initialize()
    await application.start()

    if application.updater is None:
        logger.error("Telegram updater not initialized")
        return

    try:
        logger.info("Starting polling...")
        await application.updater.start_polling(drop_pending_updates=False)
        logger.info("Polling started successfully")
    except Conflict as exc:
        logger.error(
            "Telegram polling conflict detected. Another SwiftClaw instance is "
            "already using this bot token. Stop the server-side bot before "
            "starting the Windows local mode."
        )
        raise RuntimeError(
            "Telegram bot token is already in use by another SwiftClaw instance."
        ) from exc

    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        logger.info("Telegram bot received shutdown signal")
    finally:
        if application.updater:
            await application.updater.stop()
        await application.stop()
        await application.shutdown()


async def main() -> None:
    """Main entry point."""
    setup_logging()
    prepare_runtime_environment()
    acquire_startup_lock()

    logger.info("=" * 50)
    logger.info("SwiftClaw Starting...")
    logger.info("=" * 50)

    # Check bot token validity
    try:
        from telegram import Bot
        bot = Bot(token=get_settings().telegram_bot_token)
        bot_info = await bot.get_me()
        logger.info(f"Bot connected: @{bot_info.username} (ID: {bot_info.id})")

        # Check webhook status
        webhook_info = await bot.get_webhook_info()
        if webhook_info.url:
            logger.warning(f"Webhook is set: {webhook_info.url}")
            logger.warning("This may prevent polling from receiving messages!")
        else:
            logger.info("No webhook set, polling mode is OK")
    except Exception as e:
        logger.error(f"Failed to verify bot token: {e}")

    # Run Telegram bot
    await run_telegram_bot()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
