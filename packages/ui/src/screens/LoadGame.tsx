import { useState, useEffect, type JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import { listSaves, loadSave, deleteSave } from '../ipc/client'
import type { SaveSummary } from '../electron'
import Button from '../components/Button'

export default function LoadGame(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)
  const loadWorld = useGameStore((s) => s.loadWorld)
  const [saves, setSaves] = useState<SaveSummary[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSaves()
      .then(setSaves)
      .catch((err: unknown) => setError(String(err)))
  }, [])

  function handleLoad(saveId: string): void {
    loadSave(saveId)
      .then(({ worldState, persons }) => {
        loadWorld(worldState, persons)
        setScreen('game')
      })
      .catch((err: unknown) => setError(String(err)))
  }

  function handleDelete(saveId: string): void {
    deleteSave(saveId)
      .then(() => {
        setSaves((prev) => prev.filter((s) => s.id !== saveId))
        setConfirmDelete(null)
      })
      .catch((err: unknown) => setError(String(err)))
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: '640px', padding: 'var(--space-8) var(--space-6)' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-8)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              color: 'var(--color-accent-amber)',
            }}
          >
            Load Game
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setScreen('mainMenu')}>
            ← Back
          </Button>
        </div>

        {error !== null && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-accent-red)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {error}
          </p>
        )}

        {saves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-4)',
              }}
            >
              No saves found.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setScreen('newGame')}>
              Start a new game
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {saves.map((save) => (
              <div
                key={save.id}
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: 'var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                {/* Save info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {save.saveName}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      marginTop: '2px',
                    }}
                  >
                    {save.cityId} · {save.difficulty} · Week {save.currentWeek}, {save.currentYear}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '10px',
                      color: 'var(--color-text-muted)',
                      opacity: 0.6,
                      marginTop: '2px',
                    }}
                  >
                    Last played {formatDate(save.lastPlayedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {confirmDelete === save.id ? (
                    <>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(save.id)}>
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(save.id)}>
                        Delete
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => handleLoad(save.id)}>
                        Load
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
