require('dotenv').config()

async function Log(stack, level, pkg, message) {
  try {
    const res = await fetch('http://20.207.122.201/evaluation-service/logs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stack, level, package: pkg, message })
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.error('Log failed:', err.message)
  }
}

module.exports = { Log }