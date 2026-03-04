// Database API Client
// يتصل بالسيرفر المحلي لحفظ واسترجاع البيانات من قاعدة SQLite

const DB_API = {
    baseURL: 'http://localhost:3000/api',
    isConnected: false,

    // فحص الاتصال بالسيرفر
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseURL}/status`);
            const data = await response.json();
            this.isConnected = data.online;
            return this.isConnected;
        } catch (error) {
            console.warn('⚠️ السيرفر المحلي غير متصل. سيتم استخدام localStorage فقط.');
            this.isConnected = false;
            return false;
        }
    },

    // حفظ عملية جديدة
    async saveTransaction(transaction) {
        if (!this.isConnected) {
            console.log('💾 حفظ محلي فقط (localStorage)');
            return { success: true, local: true };
        }

        try {
            const response = await fetch(`${this.baseURL}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transaction)
            });
            const result = await response.json();
            console.log('✅ تم الحفظ في قاعدة البيانات:', result);
            return result;
        } catch (error) {
            console.error('❌ خطأ في الحفظ:', error);
            return { success: false, error: error.message };
        }
    },

    // جلب جميع العمليات
    async getAllTransactions() {
        if (!this.isConnected) {
            return null; // سيستخدم localStorage
        }

        try {
            const response = await fetch(`${this.baseURL}/transactions`);
            const data = await response.json();
            console.log(`📥 تم جلب ${data.length} عملية من قاعدة البيانات`);
            return data;
        } catch (error) {
            console.error('❌ خطأ في جلب البيانات:', error);
            return null;
        }
    },

    // حذف عملية (soft delete)
    async deleteTransaction(id) {
        if (!this.isConnected) {
            return { success: true, local: true };
        }

        try {
            const response = await fetch(`${this.baseURL}/transactions/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            console.log('🗑️ تم الحذف من قاعدة البيانات');
            return result;
        } catch (error) {
            console.error('❌ خطأ في الحذف:', error);
            return { success: false, error: error.message };
        }
    },

    // مزامنة شاملة (إرسال جميع البيانات المحلية)
    async syncAll(transactions) {
        if (!this.isConnected) {
            console.log('⚠️ المزامنة غير متاحة - السيرفر غير متصل');
            return { success: false };
        }

        try {
            const response = await fetch(`${this.baseURL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions })
            });
            const result = await response.json();
            console.log('🔄 تمت المزامنة الشاملة:', result);
            return result;
        } catch (error) {
            console.error('❌ خطأ في المزامنة:', error);
            return { success: false, error: error.message };
        }
    },

    // حفظ الإعدادات
    async saveSetting(key, value) {
        if (!this.isConnected) return { success: true, local: true };

        try {
            const response = await fetch(`${this.baseURL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في حفظ الإعدادات:', error);
            return { success: false, error: error.message };
        }
    },

    // جلب الإعدادات
    async getSettings() {
        if (!this.isConnected) return null;

        try {
            const response = await fetch(`${this.baseURL}/settings`);
            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في جلب الإعدادات:', error);
            return null;
        }
    }
};

// تهيئة الاتصال عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    const connected = await DB_API.checkConnection();
    if (connected) {
        console.log('✅ متصل بقاعدة البيانات المحلية');
        showToast('✅ متصل بقاعدة البيانات', 'success');

        // جلب البيانات من قاعدة البيانات
        const dbTransactions = await DB_API.getAllTransactions();
        if (dbTransactions && dbTransactions.length > 0) {
            console.log(`📊 تم العثور على ${dbTransactions.length} عملية في قاعدة البيانات`);
            // يمكن دمجها مع البيانات المحلية هنا
        }
    } else {
        console.log('⚠️ العمل في وضع localStorage فقط');
        showToast('⚠️ قاعدة البيانات غير متصلة - استخدام التخزين المحلي', 'warning');
    }
});

// دالة محسّنة للحفظ تستخدم كلاً من localStorage وقاعدة البيانات
async function saveToStorageEnhanced() {
    const date = dateInput.value;
    if (!date) return;

    const dataToSave = {
        records: records,
        eggBalance: $('eggBalance') ? $('eggBalance').value : ''
    };

    // 1. حفظ في localStorage (سريع ومضمون)
    localStorage.setItem('acc_' + date, JSON.stringify(dataToSave));

    // 2. حفظ في قاعدة البيانات (دائم وآمن)
    if (DB_API.isConnected) {
        for (const record of records) {
            await DB_API.saveTransaction(record);
        }
    }

    beep(1000, 0.04, 0.06);
}

// دالة محسّنة للتحميل تحاول قاعدة البيانات أولاً
async function loadFromStorageEnhanced() {
    const date = dateInput.value;
    if (!date) return;

    // محاولة جلب من قاعدة البيانات أولاً
    if (DB_API.isConnected) {
        const dbData = await DB_API.getAllTransactions();
        if (dbData && dbData.length > 0) {
            // تصفية البيانات حسب التاريخ
            const dateRecords = dbData.filter(r => {
                if (!r.timestamp) return false;
                const recordDate = r.timestamp.split('T')[0];
                return recordDate === date;
            });

            if (dateRecords.length > 0) {
                records = dateRecords;
                render();
                console.log(`✅ تم تحميل ${dateRecords.length} عملية من قاعدة البيانات`);
                return;
            }
        }
    }

    // الرجوع إلى localStorage إذا لم تتوفر البيانات من قاعدة البيانات
    const raw = localStorage.getItem('acc_' + date);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            records = Array.isArray(data) ? data : (data.records || []);
            render();
            console.log(`📂 تم تحميل ${records.length} عملية من localStorage`);
        } catch (e) {
            console.error('خطأ في تحليل البيانات:', e);
            records = [];
        }
    } else {
        records = [];
        render();
    }
}
