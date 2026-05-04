import { Share2Icon } from '@radix-ui/react-icons'
import { useState } from 'react'

import { useToast } from '@/components/toast'
import { IconButton } from '@/components/ui/icon-button'

import styles from './share-button.module.css'

export function ShareButton() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleShare = async () => {
    const query = window.location.search.slice(1)
    if (!query) {
      toast('Nothing to share — configure a battle first')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) throw new Error()
      const { url } = (await res.json()) as { url: string }
      await navigator.clipboard.writeText(url)
      toast('Link copied!')
    } catch {
      toast('Failed to create short link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <IconButton
      className={styles.button}
      title="Share"
      onClick={handleShare}
      isLoading={loading}
    >
      <Share2Icon className={styles.icon} />
    </IconButton>
  )
}
