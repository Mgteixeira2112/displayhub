import ContentLibraryCore from './ContentLibraryCore'
import MonitoringPanel from './MonitoringPanel'
import PlaylistManager from './PlaylistManager'
import StructuredContent from './StructuredContent'
import TemplateManager from './TemplateManager'

type Props = {
  companyId: string
  role: string
}

export default function ContentLibrary(props: Props) {
  return (
    <>
      <ContentLibraryCore {...props} />
      <StructuredContent {...props} />
      <TemplateManager {...props} />
      <PlaylistManager {...props} />
      <MonitoringPanel companyId={props.companyId} />
    </>
  )
}
