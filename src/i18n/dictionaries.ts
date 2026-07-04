export type Locale = 'en' | 'zh'
export const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    'nav.home': 'Home', 'nav.expenses': 'Expenses', 'nav.fund': 'Fund',
    'nav.budget': 'Budget', 'nav.assets': 'Assets',
    'auth.signin': 'Sign in', 'auth.email': 'Email', 'auth.password': 'Password',
    'test.only_en': 'English only',
  },
  zh: {
    'nav.home': '首页', 'nav.expenses': '开支', 'nav.fund': '共同基金',
    'nav.budget': '预算', 'nav.assets': '资产',
    'auth.signin': '登录', 'auth.email': '电子邮件', 'auth.password': '密码',
  },
}
