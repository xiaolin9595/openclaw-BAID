"""Telegram Bot handler for message processing."""

import platform
from socket import gethostname
from typing import Any

import httpx
from loguru import logger
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from agent.llm import SwiftClawAgent
from config.settings import Settings
from memory.store import MemoryStore


class TelegramBotHandler:
    """Handler for Telegram bot messages and commands."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize Telegram bot handler.

        Args:
            settings: Application settings. If None, loads from environment.
        """
        from config import get_settings

        self.settings = settings or get_settings()
        self.allowed_users = self.settings.telegram_allowed_users
        self._swiftclaw_agent: SwiftClawAgent | None = None
        self._memory_store: MemoryStore | None = None

    @property
    def swiftclaw_agent(self) -> SwiftClawAgent:
        """Lazy initialization of SwiftClawAgent."""
        if self._swiftclaw_agent is None:
            self._swiftclaw_agent = SwiftClawAgent(
                settings=self.settings,
                memory_store=self.memory_store
            )
        return self._swiftclaw_agent

    @property
    def memory_store(self) -> MemoryStore:
        """Lazy initialization of memory store."""
        if self._memory_store is None:
            self._memory_store = MemoryStore()
        return self._memory_store

    def _is_user_authorized(self, user_id: int) -> bool:
        """Check if user is authorized to use the bot.

        Args:
            user_id: Telegram user ID.

        Returns:
            True if authorized, False otherwise.
        """
        # Empty whitelist means allow all
        if not self.allowed_users:
            return True
        return user_id in self.allowed_users

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /start command."""
        if not update.effective_user or not update.effective_chat:
            return

        user = update.effective_user
        welcome_text = f"""🦞 欢迎使用 SwiftClaw!

你好, {user.first_name or '用户'}!

我是你的个人 AI 助手。我可以:
- 💬 与你进行智能对话
- 📁 帮你管理文件
- 🔧 执行命令和脚本
- 🌐 浏览网页获取信息
- 🔍 搜索网络信息

发送 /help 查看可用命令。
"""
        await context.bot.send_message(chat_id=update.effective_chat.id, text=welcome_text)
        logger.info(f"User {user.id} ({user.username}) started the bot")

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /help command."""
        if not update.effective_chat:
            return

        help_text = """📖 SwiftClaw 帮助

可用命令:
/start - 开始使用
/help - 显示此帮助信息
/memory - 查看你的核心记忆
/clear - 清空当前会话记忆
/status - 查看服务状态

💡 我可以帮你:
- 读取、写入、列出文件
- 执行 Bash 命令（Docker 沙箱）
- 浏览网页、截图
- 搜索网络信息

直接发送消息即可与我对话!
"""
        await context.bot.send_message(chat_id=update.effective_chat.id, text=help_text)

    async def memory_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /memory command."""
        if not update.effective_chat or not update.effective_user:
            return

        try:
            await self.memory_store.initialize()
            db_user = await self.memory_store.get_or_create_user(update.effective_user.id)
            content = await self.memory_store.get_memory_md_content(db_user.telegram_id)

            if not content.strip():
                text = "📝 当前还没有存储核心记忆。对我说 '请记住...' 来添加！"
            else:
                text = f"📝 你的核心记忆：\n\n```\n{content}\n```"

            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=text,
                parse_mode="Markdown",
            )
            logger.info(f"User {update.effective_user.id} viewed memory")
        except Exception as e:
            logger.error(f"Error showing memory: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="❌ 读取记忆失败",
            )

    async def clear_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /clear command."""
        if not update.effective_chat or not update.effective_user:
            return

        try:
            # Initialize memory store
            await self.memory_store.initialize()

            # Get or create user
            user = await self.memory_store.get_or_create_user(update.effective_user.id)

            # Clear session (for now clear all conversation history)
            # TODO: implement session-based clearing
            await self.memory_store.clear_session(user.id, "default")

            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="🧹 会话记忆已清空",
            )
            logger.info(f"User {update.effective_user.id} cleared session")
        except Exception as e:
            logger.error(f"Error clearing session: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="❌ 清空记忆失败",
            )

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /status command."""
        if not update.effective_chat or not update.effective_user:
            return

        # 检测当前使用的模型
        if self.settings.anthropic_api_key:
            model_name = self.settings.anthropic_model
            provider = "Anthropic Claude"
        elif self.settings.moonshot_api_key:
            if self.settings.moonshot_api_key.startswith("sk-kimi-"):
                model_name = "kimi-for-coding"
                provider = "Kimi Code"
            else:
                model_name = self.settings.moonshot_model
                provider = "Moonshot"
        else:
            model_name = "未配置"
            provider = "未知"

        local_browser_proxy = await self._get_local_browser_proxy_status()

        status_text = f"""📊 服务状态

✅ Bot 运行正常
🖥️ 运行位置: {platform.system()} / {gethostname()}
🤖 模型: {model_name}
🏢 提供商: {provider}
👤 用户: {update.effective_user.username or update.effective_user.id}
💾 记忆系统: 已启用
🔗 代理地址: {self.settings.local_browser_proxy or "未配置"}
🖥️ 本地浏览器代理: {local_browser_proxy}
"""
        await context.bot.send_message(chat_id=update.effective_chat.id, text=status_text)

    async def _get_local_browser_proxy_status(self) -> str:
        """Check whether the configured local browser proxy is reachable."""
        proxy_url = self.settings.local_browser_proxy
        if not proxy_url:
            return "未配置"

        normalized_proxy = proxy_url.rstrip("/")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{normalized_proxy}/health")
                response.raise_for_status()
                data = response.json()

            if data.get("status") == "ok":
                platform_name = data.get("platform", "unknown")
                return f"已配置，已连通 ({platform_name})"

            return f"已配置，但健康检查返回异常: {data}"
        except Exception as e:
            return f"已配置，但无法连接: {str(e)[:120]}"

    async def _summarize_transcript(self, transcript: str, user_id: int, telegram_id: int) -> str:
        """Summarize a conversation transcript using the agent."""
        prompt = (
            f"对以下内容做摘要，输出一段简洁的自然语言（不超过300字），"
            f"只输出最终摘要文本，不要分析过程、不要解释、不要带编号列表：\n\n{transcript}"
        )
        result = await self.swiftclaw_agent.run(prompt, user_id=user_id, telegram_id=telegram_id)
        if hasattr(result, 'response') and hasattr(result.response, 'text'):
            return result.response.text
        return str(result.response)

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle incoming text messages."""
        logger.debug(f"handle_message called: update={update}")

        if not update.effective_user:
            logger.warning("No effective_user in update")
            return
        if not update.effective_chat:
            logger.warning("No effective_chat in update")
            return
        if not update.message:
            logger.warning("No message in update")
            return

        user = update.effective_user
        message_text = update.message.text
        logger.info(f"Received message from user_id={user.id}, username={user.username}, text={message_text[:50] if message_text else 'None'}")

        if not message_text:
            logger.warning("Message text is empty")
            return

        # Authorization check
        is_authorized = self._is_user_authorized(user.id)
        logger.info(f"Authorization check: user_id={user.id}, is_authorized={is_authorized}, allowed_users={self.allowed_users}")

        if not is_authorized:
            logger.warning(f"Unauthorized access attempt from user {user.id}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="⛔ 未授权访问。请联系管理员将你的用户 ID 添加到白名单。",
            )
            return

        # Send typing indicator
        await context.bot.send_chat_action(
            chat_id=update.effective_chat.id,
            action="typing",
        )

        try:
            # Initialize memory store and get/create user
            await self.memory_store.initialize()
            db_user = await self.memory_store.get_or_create_user(user.id)

            # Memory Flush check BEFORE processing
            await self.memory_store.maybe_flush_conversations(
                db_user.telegram_id, db_user.id, self._summarize_transcript
            )

            # Get conversation history for context (now up to 10 recent)
            history = await self.memory_store.get_conversation_history(db_user.id, limit=10)

            # Process message through SwiftClawAgent with history context
            response_text = await self._process_message(
                message_text, db_user.telegram_id, db_user.id, history
            )

            # Strip reasoning/thinking content before storing or sending
            response_text = self._sanitize_assistant_reply(response_text)

            # Save conversation to memory (both SQLite and Markdown log)
            await self.memory_store.save_message(db_user.telegram_id, db_user.id, "user", message_text)
            await self.memory_store.save_message(db_user.telegram_id, db_user.id, "assistant", response_text)

            # Send response (split if too long)
            await self._send_long_message(
                context.bot,
                update.effective_chat.id,
                response_text,
            )

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=f"❌ 处理消息时出错: {str(e)[:200]}",
            )

    async def _process_message(
        self,
        message: str,
        telegram_id: int,
        user_id: int,
        history: list[Any] | None = None
    ) -> str:
        """Process user message through SwiftClawAgent."""
        context_parts = []

        # 1. Load core memory.md
        try:
            memory_md = await self.memory_store.get_memory_md_content(telegram_id)
            if memory_md.strip():
                context_parts.append("Important information about the user (from memory.md):")
                context_parts.append(memory_md)
                context_parts.append("")
        except Exception as e:
            logger.warning(f"Failed to load memory.md for context: {e}")

        # 2. Add conversation history
        if history:
            context_parts.append("Previous conversation:")
            for msg in reversed(history[-10:]):
                context_parts.append(f"{msg.role}: {msg.content[:100]}...")
            context_parts.append("")

        full_message = "\n".join(context_parts) + message

        # Process through SwiftClawAgent with database user_id for memory operations
        result = await self.swiftclaw_agent.run(full_message, user_id=user_id, telegram_id=telegram_id)

        if hasattr(result, 'response') and hasattr(result.response, 'text'):
            return self._sanitize_assistant_reply(result.response.text)
        elif hasattr(result, 'response'):
            return self._sanitize_assistant_reply(str(result.response))
        else:
            return self._sanitize_assistant_reply(str(result))

    @staticmethod
    def _sanitize_assistant_reply(text: str) -> str:
        """Strip internal chain-of-thought / reasoning from assistant reply.

        Some compatible APIs (e.g., Kimi via Anthropic protocol) return
        reasoning content mixed into response.text. This heuristic extracts
        the actual final answer.
        """
        if not text or len(text) < 200:
            return text

        markers = [
            "直接输出。",
            "直接给出。",
            "这是最终输出。",
            "这是最终回复。",
            "停止思考。",
            "不需要工具调用。",
            "直接提交。",
            "最终版本：",
            "最终回答：",
            "最终输出：",
            "最终回复：",
            "停止。",
            "输出。",
        ]
        for marker in markers:
            idx = text.rfind(marker)
            if idx != -1:
                after = text[idx + len(marker) :].strip()
                if after:
                    return after
        return text

    async def _send_long_message(
        self,
        bot: Any,
        chat_id: int,
        text: str,
        max_length: int = 4000,
    ) -> None:
        """Send long message by splitting into chunks."""
        if len(text) <= max_length:
            await bot.send_message(chat_id=chat_id, text=text)
            return

        # Split into chunks
        chunks = []
        current_chunk = ""

        for line in text.split("\n"):
            if len(current_chunk) + len(line) + 1 > max_length:
                chunks.append(current_chunk)
                current_chunk = line + "\n"
            else:
                current_chunk += line + "\n"

        if current_chunk:
            chunks.append(current_chunk)

        # Send chunks
        for i, chunk in enumerate(chunks):
            prefix = f"(Part {i+1}/{len(chunks)})\n\n" if len(chunks) > 1 else ""
            await bot.send_message(chat_id=chat_id, text=prefix + chunk)

    def create_application(self) -> Application:  # type: ignore[type-arg]
        """Create and configure Telegram bot application."""
        application = Application.builder().token(self.settings.telegram_bot_token).build()

        # Add command handlers
        application.add_handler(CommandHandler("start", self.start_command))
        application.add_handler(CommandHandler("help", self.help_command))
        application.add_handler(CommandHandler("memory", self.memory_command))
        application.add_handler(CommandHandler("clear", self.clear_command))
        application.add_handler(CommandHandler("status", self.status_command))

        # Add message handler (must be last)
        application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message)
        )

        logger.info("Telegram bot application configured")
        return application
