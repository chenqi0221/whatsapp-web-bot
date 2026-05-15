<template>
  <div class="media">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>发送媒体文件</span>
            </div>
          </template>
          <el-form :model="mediaForm" label-position="top">
            <el-form-item label="选择联系人">
              <el-select v-model="mediaForm.to" filterable style="width: 100%">
                <el-option
                  v-for="chat in chats"
                  :key="chat.id"
                  :label="chat.name"
                  :value="chat.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="文件">
              <el-upload
                drag
                :auto-upload="false"
                :on-change="handleFileChange"
                :limit="1"
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">
                  拖拽文件到此处或 <em>点击上传</em>
                </div>
              </el-upload>
            </el-form-item>
            <el-form-item label="图片描述 (可选)">
              <el-input v-model="mediaForm.caption" placeholder="图片描述" />
            </el-form-item>
            <el-button type="primary" @click="sendMedia">发送媒体</el-button>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>发送位置</span>
            </div>
          </template>
          <el-form :model="locationForm" label-position="top">
            <el-form-item label="选择联系人">
              <el-select v-model="locationForm.to" filterable style="width: 100%">
                <el-option
                  v-for="chat in chats"
                  :key="chat.id"
                  :label="chat.name"
                  :value="chat.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="纬度">
              <el-input v-model="locationForm.lat" placeholder="37.422" />
            </el-form-item>
            <el-form-item label="经度">
              <el-input v-model="locationForm.lng" placeholder="-122.084" />
            </el-form-item>
            <el-form-item label="位置名称 (可选)">
              <el-input v-model="locationForm.title" placeholder="Googleplex" />
            </el-form-item>
            <el-button type="primary" @click="sendLocation">发送位置</el-button>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>发送贴纸</span>
            </div>
          </template>
          <el-form :model="stickerForm" label-position="top">
            <el-form-item label="选择联系人">
              <el-select v-model="stickerForm.to" filterable style="width: 100%">
                <el-option
                  v-for="chat in chats"
                  :key="chat.id"
                  :label="chat.name"
                  :value="chat.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="图片 URL">
              <el-input v-model="stickerForm.url" placeholder="https://example.com/image.png" />
            </el-form-item>
            <el-button type="primary" @click="sendSticker">发送贴纸</el-button>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>发送投票</span>
            </div>
          </template>
          <el-form :model="pollForm" label-position="top">
            <el-form-item label="选择联系人/群组">
              <el-select v-model="pollForm.to" filterable style="width: 100%">
                <el-option
                  v-for="chat in chats"
                  :key="chat.id"
                  :label="chat.name"
                  :value="chat.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="问题">
              <el-input v-model="pollForm.question" placeholder="你喜欢什么颜色？" />
            </el-form-item>
            <el-form-item label="选项 (每行一个)">
              <el-input
                v-model="pollForm.options"
                type="textarea"
                :rows="4"
                placeholder="红色&#10;蓝色&#10;绿色"
              />
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="pollForm.allowMultiple">允许多选</el-checkbox>
            </el-form-item>
            <el-button type="primary" @click="sendPoll">发送投票</el-button>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

const chats = ref<any[]>([])
const mediaForm = ref({ to: '', caption: '', file: null as any })
const locationForm = ref({ to: '', lat: '37.422', lng: '-122.084', title: '' })
const stickerForm = ref({ to: '', url: '' })
const pollForm = ref({ to: '', question: '', options: '', allowMultiple: false })

const loadChats = async () => {
  try {
    const response = await fetch('http://localhost:3003/api/chats')
    const data = await response.json()
    chats.value = data.chats || []
  } catch (e) {
    console.error('Failed to load chats:', e)
  }
}

const handleFileChange = (file: any) => {
  mediaForm.value.file = file.raw
}

const sendMedia = async () => {
  if (!mediaForm.value.to || !mediaForm.value.file) {
    ElMessage.warning('请选择联系人和文件')
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1]
      const response = await fetch('http://localhost:3003/api/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: mediaForm.value.to,
          media: {
            data: base64,
            mimetype: mediaForm.value.file.type,
            filename: mediaForm.value.file.name
          },
          caption: mediaForm.value.caption
        })
      })
      const data = await response.json()
      if (data.success) {
        ElMessage.success('媒体发送成功')
      } else {
        ElMessage.error(data.error)
      }
    }
    reader.readAsDataURL(mediaForm.value.file)
  } catch (e: any) {
    ElMessage.error('发送失败: ' + e.message)
  }
}

const sendLocation = async () => {
  if (!locationForm.value.to) {
    ElMessage.warning('请选择联系人')
    return
  }

  try {
    const response = await fetch('http://localhost:3003/api/send-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: locationForm.value.to,
        lat: parseFloat(locationForm.value.lat),
        lng: parseFloat(locationForm.value.lng),
        title: locationForm.value.title
      })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('位置发送成功')
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('发送失败: ' + e.message)
  }
}

const sendSticker = async () => {
  if (!stickerForm.value.to || !stickerForm.value.url) {
    ElMessage.warning('请选择联系人和图片URL')
    return
  }

  try {
    const response = await fetch('http://localhost:3003/api/send-sticker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: stickerForm.value.to,
        media: { url: stickerForm.value.url }
      })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('贴纸发送成功')
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('发送失败: ' + e.message)
  }
}

const sendPoll = async () => {
  if (!pollForm.value.to || !pollForm.value.question || !pollForm.value.options) {
    ElMessage.warning('请填写完整信息')
    return
  }

  try {
    const options = pollForm.value.options.split('\n').map(o => o.trim()).filter(o => o)
    const response = await fetch('http://localhost:3003/api/send-poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pollForm.value.to,
        question: pollForm.value.question,
        options,
        allowMultiple: pollForm.value.allowMultiple
      })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('投票发送成功')
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('发送失败: ' + e.message)
  }
}

onMounted(() => {
  loadChats()
})
</script>

<style scoped>
.media {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.media :deep(.el-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.media :deep(.el-card:hover) {
  box-shadow: var(--shadow-lg);
}

.media :deep(.el-card__header) {
  border-bottom-color: var(--border-default);
  padding: 16px 24px;
}

.media :deep(.el-card__body) {
  padding: 20px 24px;
}

.card-header {
  font-weight: bold;
}
</style>
