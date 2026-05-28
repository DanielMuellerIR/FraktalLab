import { memo } from 'react';
import Panel from '../ui/Panel'
import EnhancePhoto from '../components/EnhancePhoto'

function EnhanceView() {
  return (
    <Panel title="ENHANCE PHOTO">
      <EnhancePhoto />
    </Panel>
  )
}

export default memo(EnhanceView);
