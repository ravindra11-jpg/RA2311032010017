require('dotenv').config()
const express = require('express')
const { Log } = require('../logging_middleware')

const app = express()
app.use(express.json())
const TOKEN = process.env.ACCESS_TOKEN
const API = 'http://20.207.122.201/evaluation-service'

app.get('/schedule/:depotId', async (req, res) => {
  try {
    const depotId = Number(req.params.depotId)

    // to get all depots and find the one we need
    const depotRes = await fetch(`${API}/depots`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    })
    const depotData = await depotRes.json()
    const depot = depotData.depots.find(d => d.ID === depotId)








    
    if (!depot) {
      await Log('backend', 'warn', 'handler', `depot ${depotId} not found`)
      return res.status(404).json({ error: 'depot not found' })
    }
    const budget = depot.MechanicHours
    await Log('backend', 'info', 'handler', `found depot ${depotId} with ${budget} mechanic hours`)

    // to get all vehicles
    const vehicleRes = await fetch(`${API}/vehicles`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    })
    const vehicleData = await vehicleRes.json()
    const vehicles = vehicleData.vehicles

    await Log('backend', 'info', 'service', `running schedule for ${vehicles.length} vehicles`)




    // to pick vehicles that max impact within hour budget using knapsack
    const n = vehicles.length
    const dp = []
    for (let i = 0; i <= n; i++) {
      dp[i] = new Array(budget + 1).fill(0)
    }
    for (let i = 1; i <= n; i++) {
      const v = vehicles[i - 1]
      for (let w = 0; w <= budget; w++) {
        dp[i][w] = dp[i - 1][w]
        if (v.Duration <= w) {
          const withThis = dp[i - 1][w - v.Duration] + v.Impact
          if (withThis > dp[i][w]) dp[i][w] = withThis
        }
      }
    }






    // to trace back which vehicles got selected
    const selected = []
    let w = budget
    for (let i = n; i > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) {
        selected.push(vehicles[i - 1])
        w -= vehicles[i - 1].Duration
      }
    }

    const hoursUsed = budget - w
    await Log('backend', 'info', 'handler', `schedule done, total impact: ${dp[n][budget]}`)

    res.json({
      depotId,
      budget,
      hoursUsed,
      totalImpact: dp[n][budget],
      selectedVehicles: selected
    })

  } catch (err) {
    await Log('backend', 'error', 'handler', `something went wrong: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})






app.listen(3001, () => {
  console.log('vehicle scheduler running on port 3001')
})