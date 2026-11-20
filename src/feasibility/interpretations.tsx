import type { Question } from '@/rules'
import type { Interpretations as Readings, QuestionId } from '@/solve'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Disclosure } from '@/ui/disclosure'
import { RuleSection } from './limit-row'
import { Sources } from './sources'

function QuestionItem({ question, readingId }: { question: Question; readingId: string }) {
  const reading = question.readings.find((r) => r.id === readingId)
  return (
    <li className="py-3">
      <p className="text-sm leading-snug">{question.question}</p>
      <p className="mt-2 flex items-baseline gap-2 text-xs leading-relaxed">
        <Badge variant="secondary" className="shrink-0">{t('interpretation.decided')}</Badge>
        {reading && <span>{reading.reading}</span>}
      </p>
      <Disclosure label={t('interpretation.why')} tone="muted">
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{question.why}</p>
      </Disclosure>
      {reading && <Sources cites={reading.cites} />}
    </li>
  )
}

const isQuestionId = (id: string, readings: Readings): id is QuestionId => id in readings

export function Interpretations({ questions, readings }: { questions: readonly Question[]; readings: Readings }) {
  if (questions.length === 0) return null
  return (
    <RuleSection title={t('rules.group.interpretations')} intro={t('interpretation.intro')}>
      <ul className="flex flex-col divide-y divide-border/70">
        {questions.map((question) =>
          isQuestionId(question.id, readings) ? (
            <QuestionItem key={question.id} question={question} readingId={readings[question.id]} />
          ) : null,
        )}
      </ul>
    </RuleSection>
  )
}
