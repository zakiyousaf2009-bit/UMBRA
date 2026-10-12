import { useRef } from 'react'
import { FolderOpen, Upload } from 'lucide-react'

export function HomeSection({ onFiles }) {
  const input = useRef(null)
  return <div className="drop-zone">
    <input id="image-picker" ref={input} type="file" accept="image/*,.heic,.heif,.hif" multiple hidden onChange={event=>{onFiles(event.target.files);event.target.value=''}}/>
    <span className="drop-zone-icon"><Upload size={22}/></span><strong>Drop images here</strong><span>Any format. We detect it automatically.</span>
    <button className="button-secondary" type="button" onClick={()=>input.current?.click()}><FolderOpen size={16}/> Choose files</button>
  </div>
}

export default HomeSection
