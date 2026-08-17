# Security policy

Please do not open a public issue for a suspected vulnerability or attach confidential documents to GitHub.

Report security issues privately to `admin@flyfish.dev` with the affected version, a minimal reproduction, and impact. Remove document content that is not required to reproduce the issue.

The parser runs in a Worker and enforces limits for decompression, object counts, image pixels, nesting, malformed varints, timeout, abort, and destruction. Reports that bypass or exhaust these limits are especially useful.
