import { useEffect, useRef, useState } from 'react'
import ContentLibraryCore from './ContentLibraryCore'
import MonitoringPanel from './MonitoringPanel'
import PlaylistManager from './PlaylistManager'
import PromotionPosterManager from './PromotionPosterManager'
import StructuredContent from './StructuredContent'
import TemplateManager from './TemplateManager'
import { subscribeDataChanged } from './lib/dataRefresh'

type Props = {
  companyId: string
  role: string
}

export default function ContentLibrary(props: Props) {
  const [dataVersion, setDataVersion] = useState(0)
  const refreshTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeDataChanged(() => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(() => {
        setDataVersion((current) => current + 1)
        refreshTimerRef.current = null
      }, 120)
    })

    return () => {
      unsubscribe()
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
    }
  }, [])

  return (
    <>
      <div className="software-module module-overview">
        <MonitoringPanel companyId={props.companyId} />
      </div>

      <div key={dataVersion}>
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
      </div>

      <div className="software-module module-history">
        <MonitoringPanel companyId={props.companyId} />
      </div>
    </>
  )
}
