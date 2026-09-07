// The A2A server does not expose a CAP OData service of its own — it is a
// deterministic *executor* over backend OData services (reached via a BTP
// destination). We keep one empty service so that CAP bootstraps an Express
// app which srv/server.js hooks into to mount the A2A handlers.
service dummy {}
