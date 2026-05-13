<template>
  <div class="contact-lookup">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>联系人查询</span>
        </div>
      </template>
      <el-form :model="form" label-position="top">
        <el-form-item label="输入联系人 ID 或手机号">
          <el-input v-model="form.id" placeholder="86138xxxx@c.us" />
        </el-form-item>
        <el-button type="primary" @click="lookup">查询</el-button>
      </el-form>

      <div v-if="contact" class="contact-info">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID">{{ contact.id }}</el-descriptions-item>
          <el-descriptions-item label="名字">{{ contact.name || '无' }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ contact.pushname || '无' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ contact.number || '无' }}</el-descriptions-item>
          <el-descriptions-item label="是否企业号">
            <el-tag :type="contact.isBusiness ? 'warning' : 'info'">
              {{ contact.isBusiness ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="profilePic" class="profile-pic">
          <img :src="profilePic" alt="头像" />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const form = ref({ id: '' })
const contact = ref<any>(null)
const profilePic = ref('')

const lookup = async () => {
  if (!form.value.id) {
    ElMessage.warning('请输入联系人 ID')
    return
  }

  try {
    const response = await fetch(`http://localhost:3003/api/contact/${form.value.id}`)
    const data = await response.json()
    if (data.success) {
      contact.value = data.contact
      loadProfilePic(form.value.id)
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('查询失败: ' + e.message)
  }
}

const loadProfilePic = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/contact/${id}/profile-pic`)
    const data = await response.json()
    if (data.success) {
      profilePic.value = data.url
    }
  } catch (e) {
    console.error('Failed to load profile pic:', e)
  }
}
</script>

<style scoped>
.contact-lookup {
  padding: 0;
}
.card-header {
  font-weight: bold;
}
.contact-info {
  margin-top: 20px;
}
.profile-pic {
  margin-top: 20px;
  text-align: center;
}
.profile-pic img {
  max-width: 200px;
  border-radius: 10px;
}
</style>
