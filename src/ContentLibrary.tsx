import { Fragment, useEffect, useRef, useState } from 'react'
import ContentLibraryCore from './ContentLibraryCore'
import HomeDashboard from './HomeDashboard'
import MonitoringPanel from './MonitoringPanel'
import PlaylistManager from './PlaylistManager'
import PromotionPosterManager from './PromotionPosterManager'
import StructuredContent from './StructuredContent'
import TemplateManager from './TemplateManager'
import WikimediaVideoPickerPortal from './WikimediaVideoPickerPortal'
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
        <HomeDashboard companyId={props.companyId} />
      </div>

      <Fragment key={dataVersion}>
        <div className="software-module module-library">
          <ContentLibraryCore {...props} />
          <StructuredContent {...props} />
        </div>

        <div className="software-module module-posters">
          <PromotionPosterManager {...props} />
          <WikimediaVideoPickerPortal />
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
      </Fragment>

      <div className="software-module module-history">
        <MonitoringPanel companyId={props.companyId} />
      </div>
    </>
  )
}
