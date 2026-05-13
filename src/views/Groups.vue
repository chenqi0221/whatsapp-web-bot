<template>
  <div class="groups">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>创建群组</span>
            </div>
          </template>
          <el-form :model="createForm" label-position="top">
            <el-form-item label="群组名称">
              <el-input v-model="createForm.name" placeholder="群组名称" />
            </el-form-item>
            <el-form-item label="成员 (手机号，每行一个)">
              <el-input
                v-model="createForm.members"
                type="textarea"
                :rows="5"
                placeholder="86138xxxx@c.us"
              />
            </el-form-item>
            <el-button type="primary" @click="createGroup">创建群组</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>群组列表</span>
              <el-button type="primary" size="small" @click="loadGroups">刷新</el-button>
            </div>
          </template>
          <el-empty v-if="groups.length === 0" description="暂无群组" />
          <el-table v-else :data="groups" style="width: 100%">
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="participants" label="成员数" width="100" />
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="showGroupDetail(row.id)">详情</el-button>
                <el-button type="danger" size="small" @click="leaveGroup(row.id)">退出</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="dialogVisible" title="群组详情" width="600px">
      <div v-if="selectedGroup">
        <p><strong>名称:</strong> {{ selectedGroup.name }}</p>
        <p><strong>描述:</strong> {{ selectedGroup.description || '无' }}</p>
        <h4>成员列表</h4>
        <el-table :data="selectedGroup.participants" style="width: 100%">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="id" label="ID" />
          <el-table-column label="角色">
            <template #default="{ row }">
              <el-tag v-if="row.isSuperAdmin" type="danger">超级管理员</el-tag>
              <el-tag v-else-if="row.isAdmin" type="warning">管理员</el-tag>
              <el-tag v-else>成员</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const groups = ref<any[]>([])
const createForm = ref({ name: '', members: '' })
const dialogVisible = ref(false)
const selectedGroup = ref<any>(null)

const loadGroups = async () => {
  try {
    const response = await fetch('http://localhost:3003/api/groups')
    const data = await response.json()
    groups.value = data.groups || []
  } catch (e) {
    console.error('Failed to load groups:', e)
  }
}

const createGroup = async () => {
  if (!createForm.value.name || !createForm.value.members) {
    ElMessage.warning('请填写群组名称和成员')
    return
  }

  try {
    const members = createForm.value.members.split('\n').map(m => m.trim()).filter(m => m)
    const response = await fetch('http://localhost:3003/api/group/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createForm.value.name, members })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('群组创建成功')
      createForm.value = { name: '', members: '' }
      loadGroups()
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('创建失败: ' + e.message)
  }
}

const showGroupDetail = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/group/${id}`)
    const data = await response.json()
    if (data.success) {
      selectedGroup.value = data.group
      dialogVisible.value = true
    }
  } catch (e) {
    console.error('Failed to load group detail:', e)
  }
}

const leaveGroup = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/group/${id}/leave`, {
      method: 'POST'
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('已退出群组')
      loadGroups()
    }
  } catch (e: any) {
    ElMessage.error('退出失败: ' + e.message)
  }
}

onMounted(() => {
  loadGroups()
})
</script>

<style scoped>
.groups {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
