import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex gap-8">
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1 className="text-4xl font-bold">Vite + React</h1>
      <Badge>shadcn/ui + Tailwind CSS</Badge>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Counter Demo</CardTitle>
          <CardDescription>
            Testing shadcn/ui components with Tailwind CSS
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={() => setCount(count => count + 1)}>
            count is {count}
          </Button>
          <p className="text-muted-foreground text-sm">
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-sm">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App
