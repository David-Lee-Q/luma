import { useState } from 'react'
import { useLibrary } from '../lib/library'
import { useSettings } from '../lib/settings'
import { ConfirmSheet } from './ConfirmSheet'
import { IconCheck, IconClose, IconLock, IconRefresh, IconSparkles } from './Icons'
import { Sheet } from './Sheet'

export function CloudSheet({ onClose }: { onClose: () => void }) {
  const { settings, status, checking, setEnabled, setAutoEnhance, refreshStatus } = useSettings()
  const { photos, enhancedCount, pendingEnhanceCount, enhanceProgress, enhance, clearCloudData } =
    useLibrary()
  const [confirmClear, setConfirmClear] = useState(false)

  const analyzed = photos.filter((photo) => photo.analyzed).length
  const canEnhance = settings.enabled && status.configured && !enhanceProgress
  const targets = enhancedCount ? pendingEnhanceCount : analyzed

  return (
    <Sheet onClose={onClose} label="云端智能增强">
      <header className="sheet-head">
        <div>
          <span className="eyebrow">CLOUD ENHANCE</span>
          <h2>云端智能增强</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
          <IconClose size={19} />
        </button>
      </header>

      <div className={`cloud-status ${status.configured ? 'is-ok' : 'is-off'}`}>
        <span className="cloud-status-mark" aria-hidden="true">
          {status.configured ? <IconCheck size={14} /> : <IconLock size={14} />}
        </span>
        <div className="cloud-status-text">
          <strong>
            {checking
              ? '正在检测服务'
              : status.configured
                ? '服务端模型已就绪'
                : '服务端未配置模型密钥'}
          </strong>
          <small>
            {status.configured && status.vision
              ? `${status.vision} · ${status.embed ?? '向量'}`
              : '请在 .env 中填写 COSMO_API_KEY 后重启服务'}
          </small>
        </div>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={() => void refreshStatus()}
          aria-label="重新检测"
        >
          <IconRefresh size={16} />
        </button>
      </div>

      <label className="cloud-toggle">
        <span className="cloud-toggle-text">
          <strong>启用云端增强</strong>
          <small>
            默认关闭。开启后，每张照片先在本机压缩到 640px 长边，再发送给视觉模型生成描述、归类与点评；原图始终留在设备上。
          </small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={settings.enabled}
          disabled={!status.configured}
          onChange={(event) => setEnabled(event.target.checked)}
        />
      </label>

      <label className={`cloud-toggle ${settings.enabled ? '' : 'is-muted'}`}>
        <span className="cloud-toggle-text">
          <strong>新照片自动增强</strong>
          <small>上传完成后自动为每张新照片生成描述与归类，无需手动触发。</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={settings.autoEnhance}
          disabled={!settings.enabled}
          onChange={(event) => setAutoEnhance(event.target.checked)}
        />
      </label>

      <div className="cloud-actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={!canEnhance || !targets}
          onClick={() => void enhance()}
        >
          <IconSparkles size={16} />
          {enhancedCount
            ? targets
              ? `增强剩余 ${targets} 张`
              : '全部照片已增强'
            : `为 ${targets} 张照片生成描述`}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={!enhancedCount}
          onClick={() => setConfirmClear(true)}
        >
          清除云端数据
        </button>
      </div>

      <p className="cloud-note">
        <IconSparkles size={14} />
        已增强 {enhancedCount} 张 · 向量检索 {enhancedCount} 条 · 关闭开关不会自动删除已生成的描述
      </p>

      {confirmClear && (
        <ConfirmSheet
          title="清除云端增强数据？"
          description="将删除全部模型生成的描述、点评与向量索引，照片归回本地判定结果。照片本身不受影响。"
          confirmText="确认清除"
          onClose={() => setConfirmClear(false)}
          onConfirm={() => {
            void clearCloudData()
          }}
        />
      )}
    </Sheet>
  )
}
