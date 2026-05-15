import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import Dashboard from '@/views/Dashboard.vue'
import Broadcast from '@/views/Broadcast.vue'
import Contacts from '@/views/Contacts.vue'
import AutoReply from '@/views/AutoReply.vue'
import Schedule from '@/views/Schedule.vue'
import Groups from '@/views/Groups.vue'
import ChatManage from '@/views/ChatManage.vue'
import Media from '@/views/Media.vue'
import Messages from '@/views/Messages.vue'
import Search from '@/views/Search.vue'
import Profile from '@/views/Profile.vue'
import ContactLookup from '@/views/ContactLookup.vue'
import Stats from '@/views/Stats.vue'
import Settings from '@/views/Settings.vue'
import AccountManage from '@/views/AccountManage.vue'
import ImportedContacts from '@/views/ImportedContacts.vue'

const routes = [
    {
        path: '/',
        component: MainLayout,
        children: [
            { path: '', name: 'Dashboard', component: Dashboard },
            { path: 'accounts', name: 'AccountManage', component: AccountManage },
            { path: 'broadcast', name: 'Broadcast', component: Broadcast },
            { path: 'contacts', name: 'Contacts', component: Contacts },
            { path: 'autoreply', name: 'AutoReply', component: AutoReply },
            { path: 'schedule', name: 'Schedule', component: Schedule },
            { path: 'groups', name: 'Groups', component: Groups },
            { path: 'chatmanage', name: 'ChatManage', component: ChatManage },
            { path: 'media', name: 'Media', component: Media },
            { path: 'messages', name: 'Messages', component: Messages },
            { path: 'search', name: 'Search', component: Search },
            { path: 'profile', name: 'Profile', component: Profile },
            { path: 'contact-lookup', name: 'ContactLookup', component: ContactLookup },
            { path: 'imported-contacts', name: 'ImportedContacts', component: ImportedContacts },
            { path: 'stats', name: 'Stats', component: Stats },
            { path: 'settings', name: 'Settings', component: Settings },
        ]
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

export default router
