import type { Question } from '@/rules'
import type { Interpretations as Readings, QuestionId } from '@/solve'
import { t } from '@/text/messages'
import { PACK } from './compute'
import { Disclosure } from './disclosure'
import { RuleSection } from './limit-row'
import { Sources } from './sources'

function QuestionItem({ question, readingId }: { question: Question; readingId: string }) {
  const reading = question.readings.find((r) => r.id === readingId)
  return (
    <li className="py-3">
      <p className="text-sm leading-snug">{question.question}</p>
      <p className="mt-2 flex items-baseline gap-2 text-xs leading-relaxed">
        <span className="shrink-0 rounded-sm bg-plot-wash px-1.5 font-medium text-plot">{t('interpretation.decided')}</span>
        {reading && <span>{reading.reading}</span>}
      </p>
      <Disclosure label={t('interpretation.why')} tone="slate">
        <p className="mt-1 text-xs leading-relaxed text-slate">{question.why}</p>
      </Disclosure>
      {reading && <Sources cites={reading.cites} />}
    </li>
  )
}

const isQuestionId = (id: string, readings: Readings): id is QuestionId => id in readings

export function Interpretations({ readings }: { readings: Readings }) {
  return (
    <RuleSection title={t('rules.group.interpretations')} intro={t('interpretation.intro')}>
      <ul className="flex flex-col divide-y divide-rule/70">
        {PACK.questions.map((question) =>
          isQuestionId(question.id, readings) ? (
            <QuestionItem key={question.id} question={question} readingId={readings[question.id]} />
          ) : null,
        )}
      </ul>
    </RuleSection>
  )
}
