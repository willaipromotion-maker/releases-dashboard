import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const apiKey = process.env.ANTHROPIC_API_KEY

if (!apiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in .env.local')
  process.exit(1)
}

console.log('Testing Claude API...')
console.log('API Key found (length:', apiKey.length, ')')
console.log('')

async function testClaudeAPI() {
  try {
    console.log('Sending request to Claude API...')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Return strictly valid JSON: {"status":"ok"}'
          }
        ]
      })
    })

    console.log('Response status:', response.status)
    console.log('')

    const data = await response.json()

    if (response.ok) {
      console.log('SUCCESS!')
      console.log('')

      const text = data.content?.[0]?.text

      console.log('Raw Claude text:')
      console.log(text)
      console.log('')

      if (!text) {
        console.log('WARNING: No text found in response.content[0]')
      } else {
        let cleaned = text
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim()

        try {
          const parsed = JSON.parse(cleaned)
          console.log('Parsed JSON successfully:')
          console.log(parsed)
        } catch (err) {
          console.log('JSON parse failed')
        }
      }

      console.log('')
      console.log('Model works!')
    } else {
      console.log('ERROR from Claude API:')
      console.log(JSON.stringify(data, null, 2))
    }

  } catch (error) {
    console.error('Network error:', error.message)
  }
}

testClaudeAPI()