"""GitHub skill source for fetching skills from GitHub repositories."""

import re
from dataclasses import dataclass
from typing import Pattern

import httpx

from skills.models import Skill
from skills.parser import SkillParser


@dataclass
class ParsedSource:
    """Parsed GitHub source reference."""

    owner: str
    repo: str
    ref: str | None = None  # branch/tag/commit
    path: str | None = None  # subdirectory


class GitHubSkillSource:
    """Source for fetching skills from GitHub repositories."""

    # Raw URL template for GitHub content
    RAW_URL_TEMPLATE = "https://raw.githubusercontent.com/{owner}/{repo}/{ref}{path}/skill.md"

    # Default ref if not specified
    DEFAULT_REF = "main"

    # Regex patterns for parsing source strings
    # Full URL pattern: https://github.com/owner/repo or https://github.com/owner/repo/tree/main/subdir
    FULL_URL_PATTERN: Pattern = re.compile(
        r'^https?://github\.com/'
        r'(?P<owner>[^/]+)/'
        r'(?P<repo>[^/]+)'
        r'(?:/tree/'
        r'(?P<ref>[^/]+)'
        r'(?:/(?P<path>.+))?)?'
        r'$'
    )

    # Short format pattern: owner/repo, owner/repo@v1.0.0, owner/repo#develop
    SHORT_PATTERN: Pattern = re.compile(
        r'^(?P<owner>[^/]+)/'
        r'(?P<repo>[^/@#]+)'
        r'(?:[@#](?P<ref>[^/]+))?'
        r'(?:/(?P<path>.+))?'
        r'$'
    )

    def __init__(self) -> None:
        """Initialize the GitHub skill source."""
        self._parser = SkillParser()
        self._client = httpx.Client(timeout=30.0)

    def __del__(self) -> None:
        """Cleanup httpx client."""
        self._client.close()

    def fetch(self, source: str) -> Skill:
        """Fetch a skill from GitHub.

        Args:
            source: GitHub source reference. Supports formats:
                - owner/repo (defaults to main branch)
                - owner/repo@v1.0.0 (tag/version)
                - owner/repo#develop (branch)
                - https://github.com/owner/repo (full URL)
                - https://github.com/owner/repo/tree/main/subdir (with subdir)

        Returns:
            Skill: Parsed skill instance.

        Raises:
            ValueError: If source format is invalid, skill not found (404),
                       or network error occurs.
        """
        parsed = self._parse_source(source)
        raw_url = self._build_raw_url(parsed)

        try:
            response = self._client.get(raw_url)
        except httpx.NetworkError as e:
            raise ValueError(f"Network error fetching skill: {e}")
        except httpx.TimeoutException as e:
            raise ValueError(f"Timeout fetching skill: {e}")

        if response.status_code == 404:
            raise ValueError("Skill not found")
        elif response.status_code != 200:
            raise ValueError(f"Failed to fetch skill: HTTP {response.status_code}")

        content = response.text
        source_url = f"https://github.com/{parsed.owner}/{parsed.repo}"

        return self._parser.parse(content, source_url=source_url)

    def _parse_source(self, source: str) -> ParsedSource:
        """Parse a source string into components.

        Args:
            source: Source string in various formats.

        Returns:
            ParsedSource: Parsed components.

        Raises:
            ValueError: If source format is invalid.
        """
        # Try full URL pattern first
        match = self.FULL_URL_PATTERN.match(source)
        if match:
            return ParsedSource(
                owner=match.group("owner"),
                repo=match.group("repo"),
                ref=match.group("ref") or self.DEFAULT_REF,
                path=match.group("path")
            )

        # Try short format pattern
        match = self.SHORT_PATTERN.match(source)
        if match:
            return ParsedSource(
                owner=match.group("owner"),
                repo=match.group("repo"),
                ref=match.group("ref") or self.DEFAULT_REF,
                path=match.group("path")
            )

        raise ValueError(
            f"Invalid source format: {source}. "
            "Expected formats: owner/repo, owner/repo@v1.0.0, "
            "owner/repo#branch, or https://github.com/owner/repo"
        )

    def _build_raw_url(self, parsed: ParsedSource) -> str:
        """Build the raw GitHub URL for fetching skill content.

        Args:
            parsed: Parsed source components.

        Returns:
            str: Raw GitHub content URL.
        """
        ref = parsed.ref or self.DEFAULT_REF
        path = parsed.path or ""

        # Ensure path doesn't start or end with / and add leading / if present
        path = path.strip("/")
        if path:
            path = "/" + path

        return self.RAW_URL_TEMPLATE.format(
            owner=parsed.owner,
            repo=parsed.repo,
            ref=ref,
            path=path
        )
