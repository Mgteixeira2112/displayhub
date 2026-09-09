import ContentLibraryCore from './ContentLibraryCore'
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
    </>
  )
}
