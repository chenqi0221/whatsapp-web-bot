<template>
  <div class="settings">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>账号安全级别</span>
            </div>
          </template>
          
          <el-form label-position="top">
            <el-form-item label="当前级别">
              <el-select v-model="accountLevel" @change="updateAccountLevel">
                <el-option label="新账号（每天30条）" value="new" />
                <el-option label="稳定账号（每天80条）" value="established" />
                <el-option label="老账号（每天150条）" value="mature" />
              </el-select>
            </el-form-item>
            
            <el-form-item>
              <div class="level-info">
                <p v-if="accountLevel === 'new'">
                  <strong>新账号限制：</strong><br/>
                  每天最多30条，每小时最多5条，最小间隔60秒，每批5条后暂停3分钟
                </p>
                <p v-else-if="accountLevel === 'established'">
                  <strong>稳定账号限制：</strong><br/>
                  每天最多80条，每小时最多10条，最小间隔30秒，每批10条后暂停2分钟
                </p>
                <p v-else>
                  <strong>老账号限制：</strong><br/>
                  每天最多150条，每小时最多20条，最小间隔15秒，每批20条后暂停1分钟
                </p>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>关于</span>
            </div>
          </template>
          
          <div class="about">
            <h3>WhatsApp Bot</h3>
            <p>版本: 3.0.0</p>
            <p>基于 Tauri + Vue 3 + Rust</p>
            <p style="margin-top: 20px; color: #666;">
              这是一个 WhatsApp 自动化工具，支持群发消息、联系人管理等功能。
            </p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { systemApi } from '@/api/tauri'

const accountLevel = ref('new')

const updateAccountLevel = async () => {
    try {
        await systemApi.setAccountLevel(accountLevel.value)
        ElMessage.success('账号级别已更新')
    } catch (e: any) {
        ElMessage.error('更新失败: ' + e.message)
    }
}
</script>

<style scoped>
.settings {
  padding: 0;
}

.card-header {
  font-weight: bold;
}

.level-info {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 8px;
  line-height: 1.6;
}

.about {
  text-align: center;
  padding: 20px;
}

.about h3 {
  margin-bottom: 10px;
}

.about p {
  color: #666;
  margin: 5px 0;
}
</style>
