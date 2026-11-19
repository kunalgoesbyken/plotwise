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
    <li className="py-2.5">
      <p className="text-sm leading-snug">{question.question}</p>
      <p className="mt-1.5 inline-block rounded bg-plot-wash px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-plot uppercase">
        {t('interpretation.decided')}
      </p>
      {reading && <p className="mt-1 text-xs leading-relaxed">{reading.reading}</p>}
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
