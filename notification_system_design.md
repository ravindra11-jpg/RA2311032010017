# Notification System Design

## Stage 1

a defined structure of api is given below

**GET /notifications**

request header - Authorization: Bearer token

response:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement",
      "message": "some message",
      "isRead": false,
      "createdAt": "2026-05-02 10:00:00"
    }
  ]
}
```

**PATCH /notifications/:id/read**

just marks one notification as read
response is `{ "success": true }`

**GET /notifications/unread**

same as the first one but filtered to only unread

for realtime i think websockets makes sense here. so when a new notification comes in it gets pushed to the student directly instead of them having to refresh



## Stage 2

i'd go with postgres for this since the data is structured and relational

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  student_id UUID,
  type VARCHAR(20),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

problems i can think of as data grows:
- no indexes means full table scan every query, gets slow fast
- if too many students load notifications at the same time the db will struggle
- table will get huge over time if we never clean old notifications



## Stage 3

the query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

its slow because theres no index on any of these columns so postgres has to go through every single row to find matches. at 50k students and 5M notifications thats really bad

fix:
```sql
CREATE INDEX idx_notifs_lookup 
ON notifications(student_id, is_read, created_at DESC);
```

this way it goes directly to that students unread notifications without scanning everything

also adding indexes on every column is a bad idea - it makes writes slower because every insert has to update all the indexes too



## Stage 4

the db is being hit on every single page load which is the problem. easy fix is caching

id use redis - store each students notifications with a ttl of maybe 60 seconds. so when they load the page it hits redis first, only goes to db if cache is empty

tradeoffs:
- notifications might be slightly delayed up to 60s
- for placement notifications this is a problem so id probably bypass cache for those
- redis costs more since its in memory



## Stage 5

the pseudocode problem:

```
function notify_all(student_ids, message):
  for student_id in student_ids:
    send_email(student_id, message)
    save_to_db(student_id, message)
    push_to_app(student_id, message)
```

issues i see:
- its sequential so if send_email crashes at student 200, the other 49800 never get notified
- saving to db one by one in a loop for 50k students is going to be really slow
- no error handling so one failure kills everything

how id fix it:
- do one bulk insert to db for all students at once
- push notification jobs to a queue instead of sending directly
- have workers process the queue, if one fails it retries just that job not the whole thing



## Stage 6

for the priority inbox i fetch all notifications from the api and rank them by type - placement gets highest priority since its most important, then result, then event. within the same type i sort by timestamp so newest comes first. then just slice the top 10.

to keep this efficient as new notifications come in id maintain a sorted structure in redis so i dont have to re-sort everything on every request, just insert and trim to 10.

actual implementation is in notification_app_be/index.js