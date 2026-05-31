'use client'

import { useForm } from '@tanstack/react-form'
import { CATEGORIES, labelFor } from '@/lib/categories'
import type { RuleDoc, RuleInput } from '@/lib/extractor'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  initial?: Partial<RuleDoc>
  isPending?: boolean
  onSave: (data: RuleInput) => Promise<unknown>
  onCancel: () => void
}

function parseList(val: string): string[] {
  return val.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}

export function RuleForm({ initial, isPending, onSave, onCancel }: Props) {
  const form = useForm({
    defaultValues: {
      rule_id: initial?.rule_id ?? '',
      category: initial?.category ?? 'uncategorized',
      subcategory: initial?.subcategory ?? '',
      indicator: initial?.indicator ?? '',
      counterparty_contains: (initial?.counterparty_contains ?? []).join('\n'),
      remittance_contains: (initial?.remittance_contains ?? []).join('\n'),
      btc_contains: (initial?.btc_contains ?? []).join('\n'),
      is_transfer: initial?.is_transfer ?? false,
      is_roundup: initial?.is_roundup ?? false,
      offsets: initial?.offsets ?? '',
      enabled: initial?.enabled ?? true,
    },
    onSubmit: async ({ value }) => {
      const data: RuleInput = {
        ...(initial?.rule_id ? {} : { rule_id: value.rule_id }),
        category: value.category,
        subcategory: value.subcategory || null,
        indicator: (value.indicator as 'CRDT' | 'DBIT') || null,
        counterparty_contains: parseList(value.counterparty_contains),
        remittance_contains: parseList(value.remittance_contains),
        btc_contains: parseList(value.btc_contains),
        is_transfer: value.is_transfer,
        is_roundup: value.is_roundup,
        offsets: value.offsets || null,
        enabled: value.enabled,
      }
      await onSave(data)
    },
  })

  const isEdit = !!initial?.rule_id
  const submitting = isPending ?? form.state.isSubmitting

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      {!isEdit && (
        <form.Field name="rule_id">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule_id">
                Rule ID <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="rule_id"
                placeholder="e.g. albert_heijn"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              <p className="text-muted-foreground text-xs">
                Unique slug; becomes the provenance rule_id in enrichment.
              </p>
            </div>
          )}
        </form.Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <form.Field name="category">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>
                Category <span className="text-rose-400">*</span>
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {labelFor(c)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="subcategory">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subcategory">Subcategory</Label>
              <Input
                id="subcategory"
                placeholder="e.g. salary"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="indicator">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label>Direction (indicator)</Label>
            <Select
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="">Both (CRDT + DBIT)</SelectItem>
                  <SelectItem value="DBIT">Outgoing only (DBIT)</SelectItem>
                  <SelectItem value="CRDT">Incoming only (CRDT)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="counterparty_contains">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="counterparty_contains">
              Counterparty contains{' '}
              <span className="text-muted-foreground font-normal">(one per line or comma-separated)</span>
            </Label>
            <Textarea
              id="counterparty_contains"
              className="h-20 resize-none font-mono"
              placeholder={'albert heijn\nah to go'}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="remittance_contains">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remittance_contains">
              Remittance text contains{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="remittance_contains"
              className="h-16 resize-none font-mono"
              placeholder="afronding"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="btc_contains">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="btc_contains">
              Bank transaction code contains{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="btc_contains"
              className="h-16 resize-none font-mono"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-3">
        <form.Field name="offsets">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offsets">Offsets category</Label>
              <Input
                id="offsets"
                placeholder="e.g. housing"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <div className="flex flex-col gap-2 pt-5">
          <form.Field name="is_transfer">
            {(field) => (
              <Label className="flex items-center gap-2 cursor-pointer font-normal text-muted-foreground">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                />
                Is transfer (exclude from P&L)
              </Label>
            )}
          </form.Field>

          <form.Field name="is_roundup">
            {(field) => (
              <Label className="flex items-center gap-2 cursor-pointer font-normal text-muted-foreground">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                />
                Is round-up
              </Label>
            )}
          </form.Field>

          <form.Field name="enabled">
            {(field) => (
              <Label className="flex items-center gap-2 cursor-pointer font-normal text-muted-foreground">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                />
                Enabled
              </Label>
            )}
          </form.Field>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create rule'}
        </Button>
      </div>
    </form>
  )
}
