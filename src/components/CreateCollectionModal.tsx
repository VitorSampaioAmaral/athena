'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface CreateCollectionModalProps {
  transcriptionId: string
  onCollectionCreated: () => void
}

export function CreateCollectionModal({ transcriptionId, onCollectionCreated }: CreateCollectionModalProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Primeiro, criar a coleção
      const collectionResponse = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      })

      if (!collectionResponse.ok) {
        throw new Error('Erro ao criar coleção')
      }

      const collection = await collectionResponse.json()

      // Depois, adicionar a transcrição à coleção
      const addResponse = await fetch('/api/collections/add-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: collection.id,
          transcriptionId,
        }),
      })

      if (!addResponse.ok) {
        throw new Error('Erro ao adicionar transcrição à coleção')
      }

      setOpen(false)
      setName('')
      setDescription('')
      onCollectionCreated()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao criar coleção')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Adicionar à Coleção
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Coleção</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Nome da Coleção *
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Digite o nome da coleção"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Descrição
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Digite uma descrição para a coleção"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Criando...' : 'Criar Coleção'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 