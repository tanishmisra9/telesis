class SessionNotFound(Exception):
    """Raised when a requested session does not exist."""


class SessionNotReady(Exception):
    """Raised when session data is not yet available."""


class UpstreamUnavailable(Exception):
    """Raised when an upstream data source is unavailable."""


class CircuitGeometryUnavailable(Exception):
    """Raised when circuit geometry cannot be built from session data."""


class InvalidDriver(Exception):
    """Raised when a requested driver code is invalid for the session."""
