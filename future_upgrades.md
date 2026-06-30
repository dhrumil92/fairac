# Future Upgrades for FairAC

This document tracks architectural improvements, feature ideas, and optimizations that can be implemented when the system scales to a much larger user base.

## 1. WebSockets / Server-Sent Events (SSE) for Real-time Updates
**Current State:** 
The frontend relies on HTTP polling (e.g., fetching `/sessions/active` and `/iot/room/:id/status` every 10 seconds) when a user is on the Session page. This is extremely lightweight for standard usage (only 6 requests per minute per active user).

**Scale Issue:** 
If the system scales to thousands of concurrent users actively staring at the dashboard, this polling could generate significant HTTP traffic.

**Proposed Solution:**
Replace HTTP polling with a real-time event-driven architecture using **WebSockets** (e.g., Socket.io) or **Server-Sent Events (SSE)**.
- The server will only push an event to the frontend when a state change actually occurs (e.g., a session is started from a mobile device, or the AC is turned off).
- This achieves true instant reactivity and eliminates unnecessary empty polling requests.
