'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ImportCollectionModalProps {
  onCollectionImported: () => void
}

export function ImportCollectionModal({ onCollectionImported }: ImportCollectionModalProps) {
  const [open, setOpen] = useState(false)
  const [accessId, setAccessId] = useState('')
  const [loading, setLoading] = useState(false)
  const [collection, setCollection] = useState<any>(null)
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    if (!accessId.trim()) return

    setLoading(true)
    try {
      const response = await fetch(`/api/collections?accessId=${accessId}`)
      
      if (!response.ok) {
        throw new Error('Coleção não encontrada')
      }

      const collectionData = await response.json()
      setCollection(collectionData)
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao importar coleção. Verifique se o ID está correto.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!collection) return

    setImporting(true)
    try {
      const response = await fetch('/api/collections/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessId }),
      })

      if (!response.ok) {
        throw new Error('Erro ao importar coleção')
      }

      const importedCollection = await response.json()
      
      setOpen(false)
      setCollection(null)
      setAccessId('')
      onCollectionImported()
      
      alert(`Coleção "${importedCollection.name}" importada com sucesso!`)
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao importar coleção. Tente novamente.')
    } finally {
      setImporting(false)
    }
  }

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.readText()
      const clipboardText = await navigator.clipboard.readText()
      setAccessId(clipboardText)
    } catch (error) {
      console.error('Erro ao ler área de transferência:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          Importar Coleção
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Coleção</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="accessId" className="block text-sm font-medium mb-2">
              ID de Acesso da Coleção
            </label>
            <div className="flex space-x-2">
              <Input
                id="accessId"
                value={accessId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccessId(e.target.value)}
                placeholder="Cole o ID de acesso da coleção"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyToClipboard}
                size="sm"
              >
                Colar
              </Button>
            </div>
          </div>

          <Button
            onClick={handleImport}
            disabled={loading || !accessId.trim()}
            className="w-full"
          >
            {loading ? 'Buscando...' : 'Buscar Coleção'}
          </Button>

          {collection && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold text-lg">{collection.name}</h3>
              {collection.description && (
                <p className="text-gray-600 mt-1">{collection.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                Criada por: {collection.user?.name || collection.user?.email}
              </p>
              <p className="text-sm text-gray-500">
                {collection.items?.length || 0} transcrições
              </p>
              <div className="mt-3 space-y-2">
                <Button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="w-full"
                >
                  {importing ? 'Importando...' : 'Confirmar Importação'}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Esta ação criará uma cópia da coleção em sua conta
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 