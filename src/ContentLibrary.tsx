import ContentLibraryCore from './ContentLibraryCore'
import PlaylistManager from './PlaylistManager'
import StructuredContent from './StructuredContent'

type Props = {
  companyId: string
  role: string
}

export default function ContentLibrary(props: Props) {
  return (
    <>
      <ContentLibraryCore {...props} />
      <StructuredContent {...props} />
      <PlaylistManager {...props} />
    </>
  )
}
