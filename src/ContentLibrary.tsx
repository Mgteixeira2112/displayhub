import ContentLibraryCore from './ContentLibraryCore'
import MonitoringPanel from './MonitoringPanel'
import PlaylistManager from './PlaylistManager'
import PromotionPosterManager from './PromotionPosterManager'
import StructuredContent from './StructuredContent'
import TemplateManager from './TemplateManager'

type Props = {
  companyId: string
  role: string
}

export default function ContentLibrary(props: Props) {
  return (
    <>
      <div className="software-module module-overview">
        <MonitoringPanel companyId={props.companyId} />
      </div>

      <div className="software-module module-library">
        <ContentLibraryCore {...props} />
        <StructuredContent {...props} />
      </div>

      <div className="software-module module-posters">
        <PromotionPosterManager {...props} />
      </div>

      <div className="software-module module-playlists">
        <PlaylistManager {...props} />
      </div>

      <div className="software-module module-schedule">
        <PlaylistManager {...props} />
      </div>

      <div className="software-module module-templates">
        <TemplateManager {...props} />
      </div>

      <div className="software-module module-history">
        <MonitoringPanel companyId={props.companyId} />
      </div>
    </>
  )
}
