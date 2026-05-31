'use client'

import { useState } from 'react'
import { RuleList } from './RuleList'
import { UncategorizedPanel } from './UncategorizedPanel'
import type { RuleDoc, UncategorizedRow } from '@/lib/extractor'
import { useEnrichAll } from '@/app/rules/queries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  initialRules: RuleDoc[]
  initialUncategorized: UncategorizedRow[]
}

export function RulesAdmin({ initialRules, initialUncategorized }: Props) {
  const enrich = useEnrichAll()
  const [enrichResult, setEnrichResult] = useState<{ processed: number; enriched: number } | null>(
    null,
  )

  function handleEnrich() {
    setEnrichResult(null)
    enrich.mutate(undefined, {
      onSuccess: (result) => {
        setEnrichResult(result)
        setTimeout(() => setEnrichResult(null), 5000)
      },
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleEnrich}
          disabled={enrich.isPending}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {enrich.isPending ? (
            <span className="inline-block size-3 border-2 border-white/40 border-t-white rounded-full animate-spin" data-icon="inline-start" />
          ) : (
            <span data-icon="inline-start">⚡</span>
          )}
          {enrich.isPending ? 'Enriching…' : 'Enrich all'}
        </Button>

        {enrichResult && (
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
            ✓ {enrichResult.enriched} of {enrichResult.processed} updated
          </Badge>
        )}
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-foreground font-semibold text-lg">
            Rules{' '}
            <span className="text-muted-foreground font-normal text-sm ml-1">
              ({initialRules.length})
            </span>
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Ordered list — first match wins. Transfers must stay near the top to be excluded from
            P&L.
          </p>
        </div>
        <RuleList initialRules={initialRules} />
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-foreground font-semibold text-lg">
            Uncategorized{' '}
            {initialUncategorized.length > 0 && (
              <span className="text-rose-400 font-normal text-sm ml-1">
                ({initialUncategorized.length})
              </span>
            )}
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Click &ldquo;Add to rule&rdquo; to pre-fill a new rule, then &ldquo;Enrich all&rdquo; to reclassify.
          </p>
        </div>
        <UncategorizedPanel initialUncategorized={initialUncategorized} />
      </section>
    </div>
  )
}
