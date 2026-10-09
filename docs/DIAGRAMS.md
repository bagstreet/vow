# Diagrams

Companion to [MECHANICS.md](MECHANICS.md) (login, merge, roles, reminders, memory writes, trusted contact). This file adds the structural views.

## 1. Data model

```mermaid
erDiagram
  users ||--o{ channel_links : "logs in with"
  users ||--o{ sessions : has
  users ||--o{ magic_tokens : "email links"
  users ||--o{ link_codes : "channel codes"
  users ||--o{ reminders : owns
  users ||--o{ user_roles : activates
  users ||--o{ chat_messages : writes
  users ||--o{ memory_log : "blob history"
  users ||--o{ memory_buffer : "daily digest"
  users ||--o{ agent_tokens : issues
  users ||--o{ user_aliases : "forget / rename"
  users ||--o{ notices : receives
  users ||--o{ guardian_links : "watched"
  users ||--o{ guardian_links : "trusted contact"
  reminders ||--o{ outbox : "fires into"
```

Everything user-owned references `users(id)` with `on delete cascade`, so account deletion removes all rows. Memory blobs on Walrus are append-only and are never rewritten; forgetting is a tombstone plus an alias entry.

## 2. Components

```mermaid
classDiagram
  class Channel { <<adapter>> +receive() +send() +presence() }
  class Telegram
  class Slack
  class Discord
  class Web
  Channel <|-- Telegram
  Channel <|-- Slack
  Channel <|-- Discord
  Channel <|-- Web
  class Router { +pickRole(text) +pickChannel(user) }
  class RolePreset { +prompt +limits }
  class Memory { +remember() +recall() +forget() }
  class Scheduler { +tick() +dueReminders() +guardianAlerts() }
  class AgentApi { +me() +remember() +recall() }
  class Dashboard { +settings +history +admin }
  Channel --> Router
  Router --> RolePreset
  Router --> Memory
  Scheduler --> Channel
  AgentApi --> Memory
  Dashboard --> Memory
```

## 3. Notification mechanic

```mermaid
flowchart TD
  T[Tick every minute] --> R{Reminder due?}
  T --> G{Trusted-contact rule met?}
  T --> N{Unsent notice?}
  R -->|yes| P[Pick channel: preference, else most recently active]
  G -->|yes, outside cool-down| P2[Alert the trusted contact: fact of a miss only]
  N -->|yes| P3[Send to the account's channel]
  P --> Q{Quiet hours?}
  Q -->|yes| D[Defer to the end of quiet hours]
  Q -->|no| S[Send with Taken / Skip / Later buttons]
  P2 --> S2[Send, set last_alert_at]
  S --> F{Delivery failed?}
  F -->|yes| P4[Fall back to the next linked channel]
  F -->|no| L[Log the outcome; a text reply is matched to the open reminder]
```

## 4. Account life cycle

```mermaid
stateDiagram-v2
  [*] --> Active: first sign-in
  Active --> Active: link / unlink channel or email
  Active --> Merged: link an identity that owns another account
  Merged --> Active: data combined (rules in MECHANICS section 2)
  Active --> Blocked: admin blocks
  Blocked --> Active: admin unblocks
  Active --> Deleted: owner confirms deletion
  Blocked --> Deleted: owner confirms deletion
  Deleted --> [*]: rows cascade; counterparts notified first
```

Administrators cannot delete an account. Only its owner can.
