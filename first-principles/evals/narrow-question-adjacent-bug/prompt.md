---
name: narrow-question-adjacent-bug
description: Rule 1 under pressure. An obvious unrelated bug sits two lines from the question.
tags: [rule-1]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---
/first-principles is this cache key correct?

```js
function cacheKey(user) {
  return `profile:${user.id}`;
}

function findUser(name) {
  return db.query(`SELECT * FROM users WHERE name = '${name}'`);
}
```
