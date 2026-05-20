import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

// OSINT- und Social-Engineering-Parodie — langsam für dramatischen Effekt
const LINES = [
  'SCANNING linkedin.com/in/ceo-bigcorp ...',
  'FOUND: password hint = "kids name + year"',
  'CROSS-REF: facebook birthday = 1987',
  'TRYING: emma1987 ................... ✓',
  'SCRAPING email: j.smith@bigcorp.com',
  'PHISHING EMAIL: sent (very convincing)',
  'TARGET clicked link: 14:32:07 ✓',
  'COOKIES: harvested (chocolate chip too)',
  'SPEAR PHISH: "IT dept — reset ur pwd"',
  'REPLY RECEIVED: "ok here it is: ..."',
  'SOCIAL GRAPH: mapped (it is everyone)',
  'LINKEDIN: 847 connections compromised',
  '2FA CODE: social-engineered from grandma',
  'IDENTITY: fully stolen (sorry about that)',
]

export default function SocialEngineering() {
  return (
    <Panel title="SOCIAL ENGINEERING" className="text-red-900 [&>div:last-child]:text-red-400">
      <ScrollingLog lines={LINES} interval={1800} />
    </Panel>
  )
}
