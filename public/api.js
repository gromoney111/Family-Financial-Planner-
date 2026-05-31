/**
 * FamilyFinPlan API Client
 * Connects the frontend to the Node.js/Express backend
 * Replace all Google Apps Script calls with this
 */

const API = {
  baseUrl: window.location.origin + '/api',
  token: localStorage.getItem('ffp_token') || null,

  // Set auth token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('ffp_token', token);
    } else {
      localStorage.removeItem('ffp_token');
    }
  },

  // Generic fetch wrapper
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      const data = await response.json();

      if (response.status === 401) {
        // Token expired - logout
        this.setToken(null);
        localStorage.removeItem('ffp_user');
        window.location.reload();
        return { success: false, message: 'Session expired. Please login again.' };
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, message: 'Network error. Check your connection.' };
    }
  },

  // ============ AUTH ============
  async register(data) {
    const result = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (result.success && result.token) {
      this.setToken(result.token);
      localStorage.setItem('ffp_user', JSON.stringify(result.user));
    }
    return result;
  },

  async login(identifier, password) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    if (result.success && result.token) {
      this.setToken(result.token);
      localStorage.setItem('ffp_user', JSON.stringify(result.user));
    }
    return result;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async resetPassword(token, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  },

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  logout() {
    this.setToken(null);
    localStorage.removeItem('ffp_user');
    localStorage.removeItem('ffp_token');
  },

  // ============ FAMILY ============
  async getFamily() {
    return this.request('/family');
  },

  async getMembers() {
    return this.request('/family/members');
  },

  async addMember(data) {
    return this.request('/family/members', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateMember(memberId, data) {
    return this.request(`/family/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async removeMember(memberId) {
    return this.request(`/family/members/${memberId}`, { method: 'DELETE' });
  },

  async generateInvite() {
    return this.request('/family/invite', { method: 'POST' });
  },

  async validateInvite(code) {
    return this.request(`/family/invite/${code}`);
  },

  async transferAdmin(newAdminId) {
    return this.request('/family/transfer-admin', {
      method: 'POST',
      body: JSON.stringify({ newAdminId })
    });
  },

  async updateFamilySettings(data) {
    return this.request('/family/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // ============ TRANSACTIONS ============
  async getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/transactions?${query}`);
  },

  async getStats(month) {
    const query = month ? `?month=${month}` : '';
    return this.request(`/transactions/stats${query}`);
  },

  async addTransaction(data) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTransaction(id, data) {
    return this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteTransaction(id) {
    return this.request(`/transactions/${id}`, { method: 'DELETE' });
  },

  // ============ BUDGETS ============
  async getBudgets(month) {
    const query = month ? `?month=${month}` : '';
    return this.request(`/budgets${query}`);
  },

  async saveBudgets(budgets, month) {
    return this.request('/budgets', {
      method: 'POST',
      body: JSON.stringify({ budgets, month })
    });
  },

  async deleteBudget(id) {
    return this.request(`/budgets/${id}`, { method: 'DELETE' });
  },

  // ============ LOANS ============
  async getLoans() {
    return this.request('/loans');
  },

  async getLoanStats() {
    return this.request('/loans/stats');
  },

  async addLoan(data) {
    return this.request('/loans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateLoan(id, data) {
    return this.request(`/loans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async payEMI(id) {
    return this.request(`/loans/${id}/pay-emi`, { method: 'POST' });
  },

  async deleteLoan(id) {
    return this.request(`/loans/${id}`, { method: 'DELETE' });
  },

  async getUpcomingLoans() {
    return this.request('/loans/upcoming');
  },

  // ============ INVESTMENTS ============
  async getInvestments() {
    return this.request('/investments');
  },

  async getInvestmentStats() {
    return this.request('/investments/stats');
  },

  async addInvestment(data) {
    return this.request('/investments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateInvestment(id, data) {
    return this.request(`/investments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteInvestment(id) {
    return this.request(`/investments/${id}`, { method: 'DELETE' });
  },

  async getUpcomingInvestments() {
    return this.request('/investments/upcoming');
  },

  // ============ BALANCES ============
  async getBalances() {
    return this.request('/balances');
  },

  async saveBalance(data) {
    return this.request('/balances', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteBalance(id) {
    return this.request(`/balances/${id}`, { method: 'DELETE' });
  }
};

// Make globally accessible
window.API = API;
