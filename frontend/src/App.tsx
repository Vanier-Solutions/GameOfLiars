import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1>Hello World</h1>
      <button onClick={() => setCount((count) => count + 1)}>COUNT</button>
      <h2>Count is {count}</h2>
    </>
  )
}

export default App
