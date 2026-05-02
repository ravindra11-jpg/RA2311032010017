require('dotenv').config()
const express = require('express')
const { Log } = require('../logging_middleware')

const app = express()
app.use(express.json())

const TOKEN = process.env.ACCESS_TOKEN
const API = 'http://20.207.122.201/evaluation-service'

// placement matters most since it directly affects career, result next, event last
const notifPriority = { Placement: 3, Result: 2, Event: 1 }
async function getNotificationsFromServer() {
  const resp = await fetch(`${API}/notifications`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  })
  const body = await resp.json()
  return body.notifications
}




function sortByPriorityAndTime(notifList) {
  return notifList.sort((a, b) => {
    // higher priority type comes first
    const typeDiff = (notifPriority[b.Type] || 0) - (notifPriority[a.Type] || 0)
    if (typeDiff !== 0) return typeDiff
    // if same type, more recent one comes first
    return new Date(b.Timestamp) - new Date(a.Timestamp)
  })
}


app.get('/notifications/priority', async (req, res) => {
  try {
    await Log('backend', 'info', 'handler', 'priority inbox requested')

    const allNotifs = await getNotificationsFromServer()
    await Log('backend', 'info', 'service', `received ${allNotifs.length} notifications from api`)

    const ranked = sortByPriorityAndTime(allNotifs)
    const topResults = ranked.slice(0, 10)

    await Log('backend', 'info', 'handler', `sending back top ${topResults.length} notifications`)

    res.json({
      total: allNotifs.length,
      showing: topResults.length,
      notifications: topResults
    })
  } catch (err) {
    await Log('backend', 'error', 'handler', `notification fetch failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})






app.listen(3002, () => {
  console.log('notification service running on port 3002')
})