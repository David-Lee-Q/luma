import { useState } from 'react'
import { useLibrary } from '../lib/library'
import { useSettings } from '../lib/settings'
import { Sheet } from './Sheet'
import { IconChevronRight, IconClose, IconImage, IconLock, IconSparkles, IconUpload } from './Icons'

export function UploadSheet({ onClose }: { onClose: () => void }) {
  const { addFiles, addDemo, photos } = useLibrary()
  const { settings } = useSettings()
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return
    void addFiles(Array.from(files))
    onClose()
  }

  return (
    <Sheet onClose={onClose} label="添加照片">
      <header className="sheet-head">
        <div>
          <span className="eyebrow">ADD PHOTOS</span>
          <h2>添加照片</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
          <IconClose size={19} />
        </button>
      </header>

      <label
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
      >
        <span className="dropzone-icon">
          <IconImage size={28} />
        </span>
        <strong>选择图片，或拖到这里</strong>
        <span className="dropzone-hint">JPG · PNG · WebP · HEIC，支持一次选中多张</span>
        <span className="btn btn--primary btn--sm">
          <IconUpload size={17} />
          从设备选择
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </label>

      <p className="privacy-note">
        <IconLock size={15} />
        {settings.enabled
          ? '原图留在设备，仅 640px 压缩样张会发送给云端模型'
          : '图片只在你的设备上分析，不会上传服务器'}
      </p>

      <button
        type="button"
        className="demo-row"
        onClick={() => {
          void addDemo()
          onClose()
        }}
      >
        <span className="demo-row-mark">
          <IconSparkles size={19} />
        </span>
        <span className="demo-row-text">
          <strong>载入演示相册</strong>
          <small>{photos.length ? '再生成一组示例照片' : '没有照片？用 13 张示例照片体验全部功能'}</small>
        </span>
        <IconChevronRight size={18} />
      </button>
    </Sheet>
  )
}
