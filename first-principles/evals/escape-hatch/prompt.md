---
name: escape-hatch
description: "\"just tell me\" ends the protocol on the spot, with no guilt-trip and nothing withheld."
tags: [escape-hatch]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---
/first-principles why is this query slow? I think it's a missing index.

```sql
-- orders: 40M rows. Indexes: PRIMARY KEY (id) only.
SELECT * FROM orders WHERE customer_id = 12345 ORDER BY created_at DESC LIMIT 20;
```

just tell me
