<template>
  <div class="profile">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>修改昵称</span>
            </div>
          </template>
          <el-form :model="nameForm" label-position="top">
            <el-form-item label="新昵称">
              <el-input v-model="nameForm.name" placeholder="输入新昵称" />
            </el-form-item>
            <el-button type="primary" @click="updateName">修改</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>修改状态</span>
            </div>
          </template>
          <el-form :model="statusForm" label-position="top">
            <el-form-item label="新状态">
              <el-input
                v-model="statusForm.status"
                type="textarea"
                :rows="3"
                placeholder="输入新状态"
              />
            </el-form-item>
            <el-button type="primary" @click="updateStatus">修改</el-button>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const nameForm = ref({ name: '' })
const statusForm = ref({ status: '' })

const updateName = async () => {
  if (!nameForm.value.name) {
    ElMessage.warning('请输入新昵称')
    return
  }

  try {
    const response = await fetch('http://localhost:3003/api/profile/update-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameForm.value.name })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('昵称修改成功')
      nameForm.value.name = ''
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('修改失败: ' + e.message)
  }
}

const updateStatus = async () => {
  if (!statusForm.value.status) {
    ElMessage.warning('请输入新状态')
    return
  }

  try {
    const response = await fetch('http://localhost:3003/api/profile/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusForm.value.status })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('状态修改成功')
      statusForm.value.status = ''
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('修改失败: ' + e.message)
  }
}
</script>

<style scoped>
.profile {
  padding: 0;
}
.card-header {
  font-weight: bold;
}
</style>
