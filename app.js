// -------------------------------------------------------------
// APP CONFIG & STATE
// -------------------------------------------------------------
let STATE = {
  clientId: localStorage.getItem('clientId') || '',
  accessToken: localStorage.getItem('accessToken') || '',
  tokenExpiry: parseInt(localStorage.getItem('tokenExpiry') || '0', 10),
  folderId: localStorage.getItem('folderId') || '',
  folderName: localStorage.getItem('folderName') || '', // 保存先フォルダの表示名（Pickerで選択した際に取得）
  metadataFileId: localStorage.getItem('metadataFileId') || '',
  cards: [],          // すべての名刺データ
  filteredCards: [],  // 検索・フィルター後の名刺データ
  selectedTag: 'all', // 現在選択されているフィルタータグ
  sortMode: 'newest', // 一覧の並べ替え基準（'newest' or 'alphabet'）
  addedTags: [],      // 新規登録フォームで一時追加中のタグリスト
  editingCardId: null, // 編集中の名刺ID（null = 新規登録モード）
  language: localStorage.getItem('language') || 'ja', // UI表示言語（'ja' or 'en'。名刺データ自体には影響しない）
  kassenMode: 'tag',  // 合戦モードのチーム分け基準（'tag' or 'initial'）
  // これまでの合戦数（Google Driveのmetadata.jsonに保存。タグモード/イニシャルモードそれぞれ別に保持）
  // サインイン直後のsyncWithDrive()内でloadMetadata()が実際の値に上書きする
  kassenBattleCount: { tag: 0, initial: 0 },
  // 既にミッション画面で「？」から達成内容へめくる演出を見せた達成済みしきい値（この端末に保存）
  missionsSeen: (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('missionsSeen') || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (e) {
      return new Set();
    }
  })(),
  kassenView: 'map',  // 合戦モード画面内の表示切り替え（'map' or 'ranking'。ランキングは未実装のプレースホルダー）
  islandDetected: false, // マップ上に孤島（どのヘックスにも接していない配備）が一度でも発生したか（Google Driveに保存）
  // 一度でも達成したミッションのID一覧（Google Driveに保存）。
  // 合戦データのリセット等で元になる数値が0に戻っても、ここに記録済みのミッションは達成済みのまま保持する
  missionsAchieved: new Set(),
  // 起動日ミッション用の記録（いずれもGoogle Driveに保存）
  lastLaunchDate: null,        // 前回アプリを起動した日（'YYYY-MM-DD'）
  launchStreak: 0,             // 現在の連続起動日数
  returnAfterGapDetected: false, // 3日以上の間隔をあけてから起動したことが一度でもあるか
  // 並べ替えミッション用の記録（いずれもGoogle Driveに保存）
  usedAlphabetSort: false,          // 一度でもアルファベット順に並べ替えたか
  usedNewestSortAfterAlphabet: false, // アルファベット順に並べ替えた後、登録順に戻したことがあるか
  duelView: 'match',  // デュエルモード画面内の表示切り替え（'match' or 'ranking'）
  duelBattleCount: 0, // これまでのデュエル数（Google Driveに保存）
  // 現在の対戦セッション（画面を開くたびにリセットされる一時状態。Google Driveには保存しない）
  // netScore: -3(右が押し切って勝利)〜+3(左が押し切って勝利)。押し合いなので、相手に押し返されると相殺される
  duel: { left: null, right: null, netScore: 0, winner: null, inProgress: false },
  tokenClient: null,  // Google OAuth Token Client
  imageCache: {},     // { fileId: blobUrl }
  user: null          // { name, email, avatarUrl }
};

// Google API endpoint constants
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
// Google Picker API用のAPIキー（HTTPリファラー制限・Picker APIのみに制限済みのため、公開して問題ない）
const GOOGLE_PICKER_API_KEY = 'AIzaSyC9UqDIBywV5jYaT_qjLwB0iEPXXt7SfKM';

// -------------------------------------------------------------
// I18N（UIの表示言語のみ切り替える。名刺データ自体は翻訳しない）
// -------------------------------------------------------------
const I18N = {
  ja: {
    pageTitle: 'Cardvalia',
    btnLogin: 'Google アカウントでサインイン',
    btnOpenSetup: '初期設定 (OAuth クライアントID)',
    authDescIntro: 'Cardvaliaは、いただいた名刺をご自身のGoogleドライブだけで管理できる、名刺管理アプリです。',
    authDescFeature1: '名刺の登録・検索・タグ管理ができます',
    authDescFeature2: 'データはすべて、ご自身のGoogleドライブ内の選択したフォルダに保存されます（開発者のサーバーには一切保存されません）',
    authDescFeature3: '合戦モード・デュエルモードなど、名刺の相手を思い出すための遊び心のある機能もあります',
    linkPrivacyPolicy: 'プライバシーポリシー',

    titleSync: '同期',
    titleAdd: '新規登録',
    titleKassen: '合戦モード',
    titleDuel: 'デュエルモード',
    titleMissions: 'ミッション',
    headingMissions: 'ミッション',
    missionThreshold: '{count}枚登録',
    missionCardsWithMemo10: 'メモありで名刺を10枚登録',
    missionCardsWithoutMemo10: 'メモなしで名刺を10枚登録',
    missionThresholdTags: '{count}種類のタグ登録',
    missionMaxTagsOnCard: '{count}つのタグを持った名刺を登録',
    missionThresholdTagBattles: 'タグモードで{count}回合戦',
    missionThresholdInitialBattles: 'イニシャルモードで{count}回合戦',
    missionThresholdDuelBattles: 'デュエルで{count}回対戦',
    missionMaxPointsTag: 'タグモードで{count}pt達成の名刺が出現',
    missionMaxPointsInitial: 'イニシャルモードで{count}pt達成の名刺が出現',
    missionMaxPointsDuel: 'デュエルで{count}pt達成の名刺が出現',
    missionHexCount100: 'マップのヘックス総数100個達成',
    missionIslandDetected: 'マップに孤島が発生',
    missionAlphabetCount: 'イニシャル{count}文字制覇',
    missionAlphabetHalf: 'イニシャルアルファベット50%制覇',
    missionAlphabetFull: 'イニシャルアルファベット全制覇',
    missionSortAlphabet: 'アルファベット順に並べ替え',
    missionSortNewestAfterAlphabet: '登録順に並べ替え',
    missionLaunchStreak3: '3日連続アプリ起動',
    missionReturnAfterGap3: '3日振りにアプリ起動',
    missionCompleteAll: '全てのミッションをコンプリート',
    missionThanks: 'たくさん使ってくれてありがとう！',
    missionAchieved: '達成済み',
    missionMystery: '？？？',
    missionLocked: '名刺を登録して解放しよう',
    missionLockedBattle: '合戦をして解放しよう',
    missionLockedDuel: 'デュエルをして解放しよう',
    titleSettings: '設定',
    titleSortNewest: '並べ替え：登録が新しい順',
    titleSortAlphabet: '並べ替え：アルファベット順',
    sortPopupNewestTitle: '登録順',
    sortPopupAlphabetTitle: 'アルファベット順',
    searchPlaceholder: '名前・アルファベットで検索...',
    tagAll: 'すべて',
    emptyNoCards: '名刺が登録されていません',
    emptyAddFirst: '最初の一枚を登録する',
    emptyNoMatch: '該当する名刺が見つかりません',
    emptyAddNew: '新規名刺を登録する',
    titleEditCard: '編集',
    titleDeleteCard: '削除',
    confirmDelete: 'この名刺を削除してもよろしいですか？（Googleドライブ内の画像ファイルも削除されます）',

    addTitleNew: '新規名刺登録',
    addTitleEdit: '名刺を編集',
    photoAlt: '名刺プレビュー',
    photoPlaceholder: '名刺を撮影または画像を選択',
    btnCapture: '写真を撮る',
    btnGallery: 'アルバムから選択',
    labelName: '氏名 / 会社名',
    placeholderName: '例：山田 太郎 / 株式会社サンプル',
    labelAlphabet: '検索用アルファベット (半角英数)',
    placeholderAlphabet: '例：Yamada Taro / Sample Inc',
    alphabetPatternTitle: '半角英数字とスペースのみ入力可能です',
    labelRegisteredMonth: '登録年月',
    labelTags: 'タグ付け',
    placeholderTagInput: 'タグを入力してEnterで追加',
    btnAddTag: '追加',
    labelExistingTags: '既存のタグから選択',
    labelMemo: 'メモ',
    placeholderMemo: '面談内容や特徴など、自由にメモを残せます',
    submitNew: 'Google ドライブへ保存',
    submitEdit: '変更を保存',

    headingSettings: 'アプリ設定',
    headingOAuth: 'Google API 認証設定',
    oauthDesc: 'Google Driveへアクセスするため、ご自身の Google Cloud Console で作成したOAuthクライアントIDを入力してください。',
    labelClientId: 'OAuth クライアントID',
    btnSaveSettings: '設定を保存',
    headingAccount: 'アカウント',
    notSignedIn: '未サインイン',
    btnLogout: 'ログアウト',
    headingLanguage: '言語',
    langJapanese: '日本語',
    langEnglish: 'English',
    headingStorageFolder: '保存先フォルダ',
    storageFolderDesc: '名刺データは、ご自身のGoogleドライブ内で選択したフォルダに保存されます。',
    btnChangeFolder: 'フォルダを変更',
    noFolderSelected: '未選択',
    pickerTitle: '名刺データの保存先フォルダを選択',
    toastFolderSelectionCancelled: 'フォルダが選択されなかったため、同期を中止しました',
    headingKassenData: '合戦データ',
    btnResetKassenHistory: '合戦履歴をリセット',
    confirmResetKassenHistory: 'すべての合戦履歴をリセットします。よろしいですか？',
    toastKassenHistoryReset: '合戦履歴をリセットしました',
    toastKassenResetError: '合戦履歴のリセットに失敗しました',
    headingDuelData: 'デュエルデータ',
    btnResetDuelHistory: 'デュエルデータをリセット',
    confirmResetDuelHistory: 'すべてのデュエルデータをリセットします。よろしいですか？',
    toastDuelHistoryReset: 'デュエルデータをリセットしました',
    toastDuelResetError: 'デュエルデータのリセットに失敗しました',
    headingAppInfo: 'アプリ情報',
    infoVersion: 'バージョン',
    infoStorage: 'ストレージ',
    infoStorageValue: 'Google ドライブ（ご自身で選択したフォルダ）',

    headingKassen: '合戦モード',
    titleKassenRegenerate: '地形再生成',
    titleKassenRanking: 'ランキング',
    kassenBattleCountLabel: 'これまでの合戦数: {count}回',
    headingKassenRanking: 'MVPランキング',
    kassenRankingEmpty: 'まだMVPが選ばれていません',
    kassenRankingCount: '{count}pt',
    kassenAnniversaryLabel: '🎉 10回記念大会ボーナス！',
    kassenCentennialLabel: '🎊 100回記念大会ボーナス！',
    confirmKassenRegenerate: '現在の地形をリセットして新しい地形にします。よろしいですか？',
    btnYes: 'はい',
    btnNo: 'いいえ',
    btnClose: '閉じる',
    modeTag: 'タグモード',
    modeInitial: 'イニシャルモード',
    mapEmpty: '名刺が登録されると大陸が生まれます',
    btnStartKassen: '合戦開始',
    btnSkipKassen: 'スキップ',
    kassenOpening: '合戦開始…！',
    kassenResultBadge: '🏆 勝利軍: {team}',
    kassenMvpLabel: '本日のMVP',
    kassenMvpTitle: 'この名刺を見る',
    kassenHexTooltip: '{name}（{team}）',
    kassenUnaffiliated: '無所属',
    kassenUnknownInitial: '?',
    narrationTemplates: [
      '【{team}】{name}の活躍むなしく、惜しくも敗退…',
      '【{team}】{name}、健闘及ばず脱落…',
      '【{team}】{name}が奮戦するも、力及ばず敗退…',
      '【{team}】ここで{team}が脱落。{name}、お疲れ様でした…'
    ],

    headingDuel: 'デュエルモード',
    titleDuelRanking: 'ランキング',
    headingDuelRanking: 'デュエルポイントランキング',
    duelRankingEmpty: 'まだポイントが入っていません',
    duelRankingCount: '{count}pt',
    duelEmptyNotEnoughCards: '対戦させるには名刺が2枚以上必要です',
    duelSelectingOpponent: '対戦相手選択中',
    duelOpponentsDecided: '対戦カード決定！',
    btnStartDuel: 'デュエル開始',
    btnDuelReselect: '対戦相手再選択',
    duelOpening: 'デュエル開始…！',
    duelResultBadge: '🏆 {name}の勝利！',
    duelWinnerLabel: '勝者',
    duelBattleCountLabel: 'これまでのデュエル数: {count}回',
    duelNormalTemplates: [
      '{name}の華麗なステップ！',
      '{name}、キラリと光る一瞬のひらめき！',
      '{name}が繰り出す、優雅な一手！',
      '{name}の不思議な魅力に場がどよめく！',
      '{name}、涼しい顔でポイントを重ねる！',
      '{name}のスマイル一発！',
      '{name}、くるりと華麗なターン！',
      '{name}の瞳がキラリと輝く！',
      '{name}、風のように涼しく一歩前へ！',
      '{name}が魅せる、鮮やかな身のこなし！',
      '{name}のウインク一発、場内騒然！',
      '{name}、まるで舞うような身のこなし！',
      '{name}が繰り出す、軽やかなフェイント！',
      '{name}の指先ひとつで場の空気が変わる！',
      '{name}、静かな自信を漂わせる一手！',
      '{name}が魅せる、鮮烈なポーズ！',
      '{name}のさりげない一言に、どよめきが起こる！',
      '{name}、余裕の笑みでリズムを刻む！'
    ],
    duelSpecialTemplates: [
      '✨ {name}の必殺技「テレポート」炸裂！',
      '✨ {name}、渾身の超能力！',
      '✨ {name}が時を止めた…！',
      '✨ {name}の必殺技、決まった！',
      '✨ {name}、華麗なる大逆転の一手！',
      '✨ {name}、異次元へのワープ！',
      '✨ {name}の瞳が七色に輝く…！',
      '✨ {name}、空間を歪めた…！',
      '✨ {name}の必殺技「幻影ステップ」発動！',
      '✨ {name}、周囲の時間を操った…！',
      '✨ {name}が奇跡を呼び込んだ！',
      '✨ {name}の必殺技「星屑の舞」炸裂！',
      '✨ {name}、運命すら味方につけた…！',
      '✨ {name}の渾身の一手、場を揺るがす！',
      '✨ {name}、伝説の一手を繰り出した！'
    ],

    loadingDefault: '読み込み中...',
    loadingSigningIn: 'Googleでサインイン中...',
    loadingSyncing: 'Googleドライブと同期中...',
    loadingImage: '画像を読み込み中...',
    loadingDeleting: '名刺を削除中...',
    loadingSavingNew: 'Googleドライブに保存中...',
    loadingSavingEdit: '変更を保存中...',

    toastSetupFirst: 'はじめに「初期設定」からOAuthクライアントIDを登録してください。',
    toastAuthSuccess: 'Google認証に成功しました。',
    toastAuthError: '認証エラー: {error}',
    toastGoogleLibError: 'Google API ライブラリの初期化に失敗しました。時間をおいて再度お試しください。',
    toastAuthClientInitError: '認証クライアントの初期化に失敗しました。クライアントIDが正しいか確認してください。',
    toastLoggedOut: 'ログアウトしました',
    toastSessionExpired: 'セッションの期限が切れました。再サインインしてください。',
    toastUnauthorized: '認証エラーが発生しました。再ログインしてください。',
    toastSyncComplete: '同期が完了しました',
    toastSyncError: '同期中にエラーが発生しました',
    toastImageRequired: '名刺の画像を撮影または選択してください',
    toastRegistered: '名刺を登録しました',
    toastUpdated: '名刺を更新しました',
    toastRegisterError: '登録中にエラーが発生しました',
    toastUpdateError: '更新中にエラーが発生しました',
    toastDeleted: '名刺を削除しました',
    toastDeleteError: '削除中にエラーが発生しました',
    toastClientIdRequired: 'クライアントIDを入力してください',
    toastSettingsSaved: '設定を保存しました',
    toastNoCardsForKassen: '名刺が登録されていません',
    toastCardNotFound: '名刺が見つかりませんでした',
    userNoName: 'ユーザー名なし'
  },
  en: {
    pageTitle: 'Cardvalia',
    btnLogin: 'Sign in with Google',
    btnOpenSetup: 'Initial Setup (OAuth Client ID)',
    authDescIntro: 'Cardvalia is a business card manager that stores everything in your own Google Drive.',
    authDescFeature1: 'Register, search, and tag your business cards',
    authDescFeature2: "All data is saved to a folder you choose in your own Google Drive — the developer's servers never store it",
    authDescFeature3: 'Playful extras like Showdown Mode and Duel Mode help you remember who you met',
    linkPrivacyPolicy: 'Privacy Policy',

    titleSync: 'Sync',
    titleAdd: 'Add Card',
    titleKassen: 'Showdown Mode',
    titleDuel: 'Duel Mode',
    titleMissions: 'Missions',
    headingMissions: 'Missions',
    missionThreshold: '{count}-card milestone',
    missionCardsWithMemo10: 'Register 10 cards with a memo',
    missionCardsWithoutMemo10: 'Register 10 cards without a memo',
    missionThresholdTags: '{count}-tag milestone',
    missionMaxTagsOnCard: 'Register a card with {count}+ tags',
    missionThresholdTagBattles: '{count} Tag Mode battles',
    missionThresholdInitialBattles: '{count} Initial Mode battles',
    missionThresholdDuelBattles: '{count} Duel Mode matches',
    missionMaxPointsTag: 'A card reaches {count}pt in Tag Mode',
    missionMaxPointsInitial: 'A card reaches {count}pt in Initial Mode',
    missionMaxPointsDuel: 'A card reaches {count}pt in Duel Mode',
    missionHexCount100: 'Reach 100 hexes on the map',
    missionIslandDetected: 'An island appeared on the map',
    missionAlphabetCount: 'Conquer {count} initials',
    missionAlphabetHalf: 'Conquer 50% of the alphabet',
    missionAlphabetFull: 'Conquer the entire alphabet',
    missionSortAlphabet: 'Sort alphabetically',
    missionSortNewestAfterAlphabet: 'Sort back to newest first',
    missionLaunchStreak3: 'Open the app 3 days in a row',
    missionReturnAfterGap3: 'Come back after 3+ days away',
    missionCompleteAll: 'Complete All Missions',
    missionThanks: 'Thanks for using the app so much!',
    missionAchieved: 'Achieved',
    missionMystery: '???',
    missionLocked: 'Keep adding cards to unlock',
    missionLockedBattle: 'Fight a Showdown to unlock',
    missionLockedDuel: 'Fight a Duel to unlock',
    titleSettings: 'Settings',
    titleSortNewest: 'Sort: Newest first',
    titleSortAlphabet: 'Sort: Alphabetical',
    sortPopupNewestTitle: 'Newest First',
    sortPopupAlphabetTitle: 'Alphabetical',
    searchPlaceholder: 'Search by name or alphabet...',
    tagAll: 'All',
    emptyNoCards: 'No business cards yet',
    emptyAddFirst: 'Add your first card',
    emptyNoMatch: 'No matching cards found',
    emptyAddNew: 'Add a new card',
    titleEditCard: 'Edit',
    titleDeleteCard: 'Delete',
    confirmDelete: 'Delete this business card? The image file in Google Drive will also be deleted.',

    addTitleNew: 'Add Business Card',
    addTitleEdit: 'Edit Business Card',
    photoAlt: 'Card preview',
    photoPlaceholder: 'Take or choose a photo of the card',
    btnCapture: 'Take Photo',
    btnGallery: 'Choose from Album',
    labelName: 'Name / Company',
    placeholderName: 'e.g. Taro Yamada / Sample Inc.',
    labelAlphabet: 'Alphabet for search (letters/numbers only)',
    placeholderAlphabet: 'e.g. Yamada Taro / Sample Inc',
    alphabetPatternTitle: 'Only letters, numbers, and spaces are allowed',
    labelRegisteredMonth: 'Registration Month',
    labelTags: 'Tags',
    placeholderTagInput: 'Type a tag and press Enter',
    btnAddTag: 'Add',
    labelExistingTags: 'Choose from existing tags',
    labelMemo: 'Memo',
    placeholderMemo: 'Notes, meeting details, anything you want to remember',
    submitNew: 'Save to Google Drive',
    submitEdit: 'Save Changes',

    headingSettings: 'Settings',
    headingOAuth: 'Google API Authentication',
    oauthDesc: 'To access Google Drive, enter the OAuth Client ID you created in your own Google Cloud Console.',
    labelClientId: 'OAuth Client ID',
    btnSaveSettings: 'Save Settings',
    headingAccount: 'Account',
    notSignedIn: 'Not signed in',
    btnLogout: 'Sign Out',
    headingLanguage: 'Language',
    langJapanese: '日本語',
    langEnglish: 'English',
    headingStorageFolder: 'Storage Folder',
    storageFolderDesc: 'Your business card data is stored in a folder you choose within your own Google Drive.',
    btnChangeFolder: 'Change Folder',
    noFolderSelected: 'Not selected',
    pickerTitle: 'Choose a folder to store your business card data',
    toastFolderSelectionCancelled: 'No folder was selected, so the sync was cancelled',
    headingKassenData: 'Showdown Data',
    btnResetKassenHistory: 'Reset Showdown History',
    confirmResetKassenHistory: 'This will reset all Showdown history. Continue?',
    toastKassenHistoryReset: 'Showdown history has been reset',
    toastKassenResetError: 'Failed to reset Showdown history',
    headingDuelData: 'Duel Data',
    btnResetDuelHistory: 'Reset Duel Data',
    confirmResetDuelHistory: 'This will reset all Duel data. Continue?',
    toastDuelHistoryReset: 'Duel data has been reset',
    toastDuelResetError: 'Failed to reset Duel data',
    headingAppInfo: 'App Info',
    infoVersion: 'Version',
    infoStorage: 'Storage',
    infoStorageValue: 'Google Drive (a folder you choose)',

    headingKassen: 'Showdown Mode',
    titleKassenRegenerate: 'Regenerate Terrain',
    titleKassenRanking: 'Ranking',
    kassenBattleCountLabel: 'Battles so far: {count}',
    headingKassenRanking: 'MVP Ranking',
    kassenRankingEmpty: 'No MVPs have been awarded yet',
    kassenRankingCount: '{count}pt',
    kassenAnniversaryLabel: '🎉 10-Battle Anniversary Bonus!',
    kassenCentennialLabel: '🎊 100-Battle Anniversary Bonus!',
    confirmKassenRegenerate: 'This will reset the current terrain and generate a new layout. Continue?',
    btnYes: 'Yes',
    btnNo: 'No',
    btnClose: 'Close',
    modeTag: 'Tag Mode',
    modeInitial: 'Initial Mode',
    mapEmpty: 'A continent will form as you add cards',
    btnStartKassen: 'Start Showdown',
    btnSkipKassen: 'Skip',
    kassenOpening: 'The showdown begins...!',
    kassenResultBadge: '🏆 Winning Army: {team}',
    kassenMvpLabel: "Today's MVP",
    kassenMvpTitle: 'View this card',
    kassenHexTooltip: '{name} ({team})',
    kassenUnaffiliated: 'Unaffiliated',
    kassenUnknownInitial: '?',
    narrationTemplates: [
      "[{team}] Despite {name}'s efforts, narrowly defeated...",
      '[{team}] {name} fought hard but was eliminated...',
      '[{team}] {name} put up a struggle, but it was not enough...',
      '[{team}] {team} has fallen here. Well fought, {name}...'
    ],

    headingDuel: 'Duel Mode',
    titleDuelRanking: 'Ranking',
    headingDuelRanking: 'Duel Point Ranking',
    duelRankingEmpty: 'No points yet',
    duelRankingCount: '{count}pt',
    duelEmptyNotEnoughCards: 'You need at least 2 cards to duel',
    duelSelectingOpponent: 'Selecting opponent...',
    duelOpponentsDecided: 'Matchup decided!',
    btnStartDuel: 'Start Duel',
    btnDuelReselect: 'Reselect Opponents',
    duelOpening: 'Duel start...!',
    duelResultBadge: '🏆 {name} wins!',
    duelWinnerLabel: 'Winner',
    duelBattleCountLabel: 'Duels so far: {count}',
    duelNormalTemplates: [
      "{name}'s graceful step!",
      '{name} flashes a dazzling wink!',
      '{name} makes an elegant move!',
      "The crowd gasps at {name}'s mysterious charm!",
      '{name} calmly scores another point!',
      "{name}'s winning smile lands!",
      '{name} spins with elegant flair!',
      "{name}'s eyes sparkle with mischief!",
      '{name} glides forward like the wind!',
      '{name} shows off a dazzling bit of footwork!',
      "{name}'s wink sends the crowd into a frenzy!",
      '{name} moves as if dancing on air!',
      '{name} slips in a light feint!',
      "{name}'s fingertip shifts the mood of the room!",
      '{name} exudes quiet confidence!',
      '{name} strikes a striking pose!',
      "{name}'s offhand remark draws gasps!",
      '{name} keeps the rhythm with an easy smile!'
    ],
    duelSpecialTemplates: [
      '✨ {name} unleashes a finishing move: Teleport!',
      '✨ {name} channels incredible psychic power!',
      '✨ {name} stops time itself...!',
      "✨ {name}'s finishing move connects!",
      '✨ {name} pulls off a stunning comeback!',
      '✨ {name} warps into another dimension!',
      "✨ {name}'s eyes shimmer with every color...!",
      '✨ {name} bends space itself...!',
      '✨ {name} unleashes the finishing move: Phantom Step!',
      '✨ {name} commands the flow of time...!',
      '✨ {name} summons a miracle!',
      '✨ {name} unleashes the finishing move: Stardust Dance!',
      '✨ {name} bends fate to their will...!',
      "✨ {name}'s all-out strike shakes the arena!",
      '✨ {name} pulls off a legendary move!'
    ],

    loadingDefault: 'Loading...',
    loadingSigningIn: 'Signing in with Google...',
    loadingSyncing: 'Syncing with Google Drive...',
    loadingImage: 'Loading image...',
    loadingDeleting: 'Deleting card...',
    loadingSavingNew: 'Saving to Google Drive...',
    loadingSavingEdit: 'Saving changes...',

    toastSetupFirst: 'First, register your OAuth Client ID from "Initial Setup".',
    toastAuthSuccess: 'Signed in with Google successfully.',
    toastAuthError: 'Authentication error: {error}',
    toastGoogleLibError: 'Failed to initialize the Google API library. Please try again later.',
    toastAuthClientInitError: 'Failed to initialize the auth client. Please check that the Client ID is correct.',
    toastLoggedOut: 'Signed out',
    toastSessionExpired: 'Your session has expired. Please sign in again.',
    toastUnauthorized: 'An authentication error occurred. Please sign in again.',
    toastSyncComplete: 'Sync complete',
    toastSyncError: 'An error occurred while syncing',
    toastImageRequired: 'Please take or choose a photo of the business card',
    toastRegistered: 'Business card saved',
    toastUpdated: 'Business card updated',
    toastRegisterError: 'An error occurred while saving',
    toastUpdateError: 'An error occurred while updating',
    toastDeleted: 'Business card deleted',
    toastDeleteError: 'An error occurred while deleting',
    toastClientIdRequired: 'Please enter a Client ID',
    toastSettingsSaved: 'Settings saved',
    toastNoCardsForKassen: 'No business cards are registered',
    toastCardNotFound: 'Business card not found',
    userNoName: 'No name'
  }
};

// 翻訳キーを現在のUI言語の文字列に変換する。{param}形式のプレースホルダーは置換される。
function t(key, params) {
  const lang = (I18N[STATE.language]) ? STATE.language : 'ja';
  let str = I18N[lang][key];
  if (str === undefined) str = I18N.ja[key];
  if (str === undefined) return key;

  if (params) {
    Object.keys(params).forEach(p => {
      str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
  }
  return str;
}

// UI表示言語を切り替える。名刺データ（氏名・メモ等の入力内容）は一切変更しない。
function applyLanguage(lang) {
  if (!I18N[lang]) lang = 'ja';
  STATE.language = lang;
  localStorage.setItem('language', lang);
  document.documentElement.lang = lang;
  document.title = t('pageTitle');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    el.alt = t(el.dataset.i18nAlt);
  });

  document.querySelectorAll('.lang-switch-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // サインイン中は実際のユーザー名を上書きしないよう、未サインイン時のみ翻訳する
  if (!STATE.user) {
    elements.userName.textContent = t('notSignedIn');
  }

  // 動的に生成される画面（一覧・タグフィルター・追加/編集画面）を現在の言語で再描画
  updateSortButtonUI();
  renderApp();
  elements.addScreenTitle.textContent = STATE.editingCardId ? t('addTitleEdit') : t('addTitleNew');
  elements.btnSubmitText.textContent = STATE.editingCardId ? t('submitEdit') : t('submitNew');
  renderAddedTags();

  // 合戦モード表示中のみ地図を再描画（不要なDrive書き込みを避けるため）
  if (document.getElementById('screen-kassen').classList.contains('active')) {
    renderKassenMap();
    updateKassenBattleCountDisplay();
    if (STATE.kassenView === 'ranking') renderKassenRanking();
  }

  // ミッション画面表示中のみ再描画
  if (document.getElementById('screen-missions').classList.contains('active')) {
    renderMissions();
  }
}

// -------------------------------------------------------------
// DOM ELEMENTS
// -------------------------------------------------------------
const elements = {
  app: document.getElementById('app'),
  // Screens
  screenAuth: document.getElementById('screen-auth'),
  screenMain: document.getElementById('screen-main'),
  screenAdd: document.getElementById('screen-add'),
  screenSettings: document.getElementById('screen-settings'),
  screenMissions: document.getElementById('screen-missions'),
  // Auth Screen
  btnLogin: document.getElementById('btn-login'),
  btnOpenSetup: document.getElementById('btn-open-setup'),
  // Main Screen
  btnSync: document.getElementById('btn-sync'),
  btnAddCard: document.getElementById('btn-add-card'),
  btnMissions: document.getElementById('btn-missions'),
  btnSettings: document.getElementById('btn-settings'),
  searchInput: document.getElementById('search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  btnSort: document.getElementById('btn-sort'),
  sortModePopup: document.getElementById('sort-mode-popup'),
  sortModePopupTitle: document.getElementById('sort-mode-popup-title'),
  tagFilters: document.getElementById('tag-filters'),
  cardDeck: document.getElementById('card-deck'),
  cardIndicator: document.getElementById('card-indicator'),
  cardCounter: document.getElementById('card-counter'),
  btnPrevCard: document.getElementById('btn-prev-card'),
  btnNextCard: document.getElementById('btn-next-card'),
  btnEmptyAdd: document.getElementById('btn-empty-add'),
  // Add Screen
  formAddCard: document.getElementById('form-add-card'),
  photoPreviewWrapper: document.getElementById('photo-preview-wrapper'),
  photoPreview: document.getElementById('photo-preview'),
  photoPlaceholder: document.getElementById('photo-placeholder'),
  inputFile: document.getElementById('input-file'),
  btnCapture: document.getElementById('btn-capture'),
  btnGallery: document.getElementById('btn-gallery'),
  inputName: document.getElementById('input-name'),
  inputAlphabet: document.getElementById('input-alphabet'),
  inputRegisteredMonth: document.getElementById('input-registered-month'),
  inputMemo: document.getElementById('input-memo'),
  inputTag: document.getElementById('input-tag'),
  btnAddTag: document.getElementById('btn-add-tag'),
  addedTagsList: document.getElementById('added-tags-list'),
  existingTagsSection: document.getElementById('existing-tags-section'),
  existingTagsList: document.getElementById('existing-tags-list'),
  btnCancelAdd: document.getElementById('btn-cancel-add'),
  btnSubmitCard: document.getElementById('btn-submit-card'),
  btnSubmitText: document.getElementById('btn-submit-text'),
  addScreenTitle: document.getElementById('add-screen-title'),
  // Settings Screen
  inputClientId: document.getElementById('input-client-id'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  userAvatar: document.getElementById('user-avatar'),
  btnLogout: document.getElementById('btn-logout'),
  currentFolderName: document.getElementById('current-folder-name'),
  btnChangeFolder: document.getElementById('btn-change-folder'),
  langSwitch: document.getElementById('lang-switch'),
  btnResetKassenHistory: document.getElementById('btn-reset-kassen-history'),
  kassenResetConfirm: document.getElementById('kassen-reset-confirm'),
  btnResetKassenHistoryYes: document.getElementById('btn-reset-kassen-history-yes'),
  btnResetKassenHistoryNo: document.getElementById('btn-reset-kassen-history-no'),
  btnResetDuelHistory: document.getElementById('btn-reset-duel-history'),
  duelResetConfirm: document.getElementById('duel-reset-confirm'),
  btnResetDuelHistoryYes: document.getElementById('btn-reset-duel-history-yes'),
  btnResetDuelHistoryNo: document.getElementById('btn-reset-duel-history-no'),
  // Missions Screen（ミッション）
  btnCloseMissions: document.getElementById('btn-close-missions'),
  missionsList: document.getElementById('missions-list'),
  // Kassen Mode Screen（合戦モード）
  btnKassen: document.getElementById('btn-kassen'),
  btnCloseKassen: document.getElementById('btn-close-kassen'),
  btnKassenRegenerate: document.getElementById('btn-kassen-regenerate'),
  btnKassenRanking: document.getElementById('btn-kassen-ranking'),
  kassenRankingView: document.getElementById('kassen-ranking-view'),
  kassenRankingList: document.getElementById('kassen-ranking-list'),
  btnCloseKassenRanking: document.getElementById('btn-close-kassen-ranking'),
  kassenBattleCount: document.getElementById('kassen-battle-count'),
  kassenRegenerateConfirm: document.getElementById('kassen-regenerate-confirm'),
  btnKassenRegenerateYes: document.getElementById('btn-kassen-regenerate-yes'),
  btnKassenRegenerateNo: document.getElementById('btn-kassen-regenerate-no'),
  kassenModeSwitch: document.getElementById('kassen-mode-switch'),
  kassenMap: document.getElementById('kassen-map'),
  kassenMapWrapper: document.querySelector('.kassen-map-wrapper'),
  kassenEmptyState: document.getElementById('kassen-empty-state'),
  kassenHexPopup: document.getElementById('kassen-hex-popup'),
  kassenLegend: document.getElementById('kassen-legend'),
  btnStartKassen: document.getElementById('btn-start-kassen'),
  kassenCommentary: document.getElementById('kassen-commentary'),
  kassenCommentaryText: document.getElementById('kassen-commentary-text'),
  btnSkipKassen: document.getElementById('btn-skip-kassen'),
  kassenResult: document.getElementById('kassen-result'),
  // Duel Mode Screen（デュエルモード）
  btnDuel: document.getElementById('btn-duel'),
  btnCloseDuel: document.getElementById('btn-close-duel'),
  btnDuelRanking: document.getElementById('btn-duel-ranking'),
  duelRankingView: document.getElementById('duel-ranking-view'),
  duelRankingList: document.getElementById('duel-ranking-list'),
  btnCloseDuelRanking: document.getElementById('btn-close-duel-ranking'),
  duelEmptyState: document.getElementById('duel-empty-state'),
  duelMatch: document.getElementById('duel-match'),
  duelLeftImageWrapper: document.getElementById('duel-left-image-wrapper'),
  duelLeftName: document.getElementById('duel-left-name'),
  duelRightImageWrapper: document.getElementById('duel-right-image-wrapper'),
  duelRightName: document.getElementById('duel-right-name'),
  duelBarFillLeft: document.getElementById('duel-bar-fill-left'),
  duelBarFillRight: document.getElementById('duel-bar-fill-right'),
  duelCommentary: document.getElementById('duel-commentary'),
  duelCommentaryText: document.getElementById('duel-commentary-text'),
  btnStartDuel: document.getElementById('btn-start-duel'),
  btnDuelReselect: document.getElementById('btn-duel-reselect'),
  duelResult: document.getElementById('duel-result'),
  duelBattleCount: document.getElementById('duel-battle-count'),
  duelSelectPopup: document.getElementById('duel-select-popup'),
  duelSelectPopupTitle: document.getElementById('duel-select-popup-title'),
  // Common UI
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message')
};

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // SVGアイコンをLucideでレンダリング
  lucide.createIcons();

  // 保存済みのUI言語を適用
  applyLanguage(STATE.language);

  // イベントリスナーの登録
  registerEventListeners();

  // 設定画面に保存済みのクライアントIDをセット
  if (STATE.clientId) {
    elements.inputClientId.value = STATE.clientId;
    initGoogleAuth();
  }

  // セッション有効性のチェック
  checkSession();
}

function checkSession() {
  const now = Date.now();
  if (STATE.accessToken && STATE.tokenExpiry > now) {
    // セッション有効
    showScreen('screen-main');
    syncWithDrive();
  } else {
    // セッションが無効（または期限切れ）の場合、サイレントログインを試みる
    attemptSilentLogin();
  }
}

let silentLoginTimeout = null;

function attemptSilentLogin() {
  const hasLoggedInBefore = localStorage.getItem('accessToken') || localStorage.getItem('folderId');
  if (STATE.tokenClient && hasLoggedInBefore) {
    console.log('Attempting silent login...');
    showLoading(t('loadingSigningIn'));
    // ブラウザの制限等でコールバックが一切呼ばれないケースに備え、
    // 一定時間応答がなければ強制的にサインイン画面へフォールバックする
    clearTimeout(silentLoginTimeout);
    silentLoginTimeout = setTimeout(() => {
      console.log('Silent login timed out, showing sign-in screen.');
      hideLoading();
      showScreen('screen-auth');
    }, 4000);
    // prompt: 'none' でポップアップを出さずにトークンを再要求
    STATE.tokenClient.requestAccessToken({ prompt: 'none' });
  } else {
    showScreen('screen-auth');
  }
}

// -------------------------------------------------------------
// NAVIGATION & SCREEN SWITCHING
// -------------------------------------------------------------
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  const activeScreen = document.getElementById(screenId);
  if (activeScreen) {
    activeScreen.classList.add('active');
  }
  // Lucideアイコンの再読み込み
  lucide.createIcons();
}

// -------------------------------------------------------------
// TOAST & LOADING OVERLAYS
// -------------------------------------------------------------
function showLoading(text = t('loadingDefault')) {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
}

function showToast(message, duration = 3000) {
  elements.toastMessage.textContent = message;
  elements.toast.classList.add('active');
  elements.toast.classList.remove('hidden');

  setTimeout(() => {
    elements.toast.classList.remove('active');
    setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, 300);
  }, duration);
}

// -------------------------------------------------------------
// GOOGLE OAUTH 2.0 (AUTHENTICATION)
// -------------------------------------------------------------
function initGoogleAuth() {
  if (!STATE.clientId) return;

  try {
    // GSIクライアントの初期化
    STATE.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: STATE.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: (tokenResponse) => {
        clearTimeout(silentLoginTimeout);
        if (tokenResponse.error) {
          hideLoading();
          // サイレントログイン失敗時はエラー通知を出さずにサインイン画面へ誘導
          if (tokenResponse.error === 'interaction_required' || tokenResponse.error === 'immediate_failed') {
            console.log('Silent login failed, showing sign-in screen.');
            showScreen('screen-auth');
          } else {
            showToast(t('toastAuthError', { error: tokenResponse.error }));
          }
          return;
        }

        STATE.accessToken = tokenResponse.access_token;
        STATE.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);

        localStorage.setItem('accessToken', STATE.accessToken);
        localStorage.setItem('tokenExpiry', STATE.tokenExpiry.toString());

        showToast(t('toastAuthSuccess'));
        fetchUserProfile();
        showScreen('screen-main');
        syncWithDrive();
      },
    });
  } catch (error) {
    console.error('Google Auth Init Error:', error);
    showToast(t('toastGoogleLibError'));
  }
}

function handleLogin() {
  if (!STATE.clientId) {
    showToast(t('toastSetupFirst'));
    showScreen('screen-settings');
    return;
  }

  showLoading(t('loadingSigningIn'));
  if (!STATE.tokenClient) {
    initGoogleAuth();
  }

  if (STATE.tokenClient) {
    // 期限切れか新規の場合のみ認証要求、すでに持っていればスキップ可能
    STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    hideLoading();
    showToast(t('toastAuthClientInitError'));
  }
}

function logout() {
  STATE.accessToken = '';
  STATE.tokenExpiry = 0;
  STATE.cards = [];
  STATE.filteredCards = [];
  STATE.imageCache = {};
  localStorage.removeItem('accessToken');
  localStorage.removeItem('tokenExpiry');
  localStorage.removeItem('folderId');
  localStorage.removeItem('folderName');
  localStorage.removeItem('metadataFileId');
  
  showToast(t('toastLoggedOut'));
  showScreen('screen-auth');
}

async function fetchUserProfile() {
  if (!STATE.accessToken) return;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${STATE.accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      STATE.user = data;
      elements.userName.textContent = data.name || t('userNoName');
      elements.userEmail.textContent = data.email || '';
      if (data.picture) {
        elements.userAvatar.innerHTML = `<img src="${data.picture}" alt="avatar" style="width:100%; height:100%; border-radius:50%;">`;
      }
    }
  } catch (e) {
    console.error('Failed to fetch user profile:', e);
  }
}

// -------------------------------------------------------------
// GOOGLE DRIVE API OPERATIONS
// -------------------------------------------------------------
async function driveFetch(url, options = {}) {
  // トークンの有効期限チェック
  if (Date.now() >= STATE.tokenExpiry) {
    showToast(t('toastSessionExpired'));
    logout();
    throw new Error('Token expired');
  }

  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${STATE.accessToken}`;

  const response = await fetch(url, options);

  if (response.status === 401) {
    showToast(t('toastUnauthorized'));
    logout();
    throw new Error('Unauthorized');
  }

  return response;
}

// Google Picker（フォルダ選択UI）の読み込み。初回のみ実際にロードし、以降はキャッシュしたPromiseを返す
let googlePickerLoadPromise = null;
function loadGooglePicker() {
  if (!googlePickerLoadPromise) {
    googlePickerLoadPromise = new Promise((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        reject(new Error('Google API loader is not available'));
        return;
      }
      gapi.load('picker', { callback: resolve, onerror: reject });
    });
  }
  return googlePickerLoadPromise;
}

// ユーザーが自身のGoogleドライブ内の任意のフォルダを保存先として選ぶ（Picker経由で選んだフォルダには
// drive.fileスコープのままアクセス権が付与されるため、スコープを広げる必要はない）。
// キャンセル時はnullを返す
async function openFolderPicker() {
  await loadGooglePicker();

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMode(google.picker.DocsViewMode.LIST);

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(STATE.accessToken)
      .setDeveloperKey(GOOGLE_PICKER_API_KEY)
      .addView(view)
      .setTitle(t('pickerTitle'))
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ id: doc.id, name: doc.name });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

function saveSelectedFolder(folder) {
  STATE.folderId = folder.id;
  STATE.folderName = folder.name;
  localStorage.setItem('folderId', STATE.folderId);
  localStorage.setItem('folderName', STATE.folderName);
  updateFolderNameDisplay();
}

function updateFolderNameDisplay() {
  if (elements.currentFolderName) {
    elements.currentFolderName.textContent = STATE.folderName || t('noFolderSelected');
  }
}

// ドライブの保存先フォルダとメタデータの同期
async function syncWithDrive() {
  showLoading(t('loadingSyncing'));
  try {
    // ユーザー情報の取得（未取得の場合）
    if (!STATE.user) {
      await fetchUserProfile();
    }

    // 1. 保存先フォルダが未選択なら、Pickerでユーザーに選んでもらう
    if (!STATE.folderId) {
      hideLoading();
      const folder = await openFolderPicker();
      if (!folder) {
        showToast(t('toastFolderSelectionCancelled'));
        return;
      }
      saveSelectedFolder(folder);
      showLoading(t('loadingSyncing'));
    }

    // 2. metadata.jsonの存在確認・作成・取得
    if (!STATE.metadataFileId) {
      STATE.metadataFileId = await getOrCreateMetadataFileId();
      localStorage.setItem('metadataFileId', STATE.metadataFileId);
    }

    // 3. メタデータファイルのダウンロード
    await loadMetadata();
    trackAppLaunch();

    hideLoading();
    showToast(t('toastSyncComplete'));
    renderApp();
  } catch (error) {
    console.error('Sync Error:', error);
    hideLoading();
    showToast(t('toastSyncError'));
  }
}

// metadata.json の検索または作成
async function getOrCreateMetadataFileId() {
  const query = encodeURIComponent(`name = 'metadata.json' and '${STATE.folderId}' in parents and trashed = false`);
  const res = await driveFetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id)`);
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // 存在しないので、空の配列 [] を書き込んで新規作成
  const fileMetadata = {
    name: 'metadata.json',
    parents: [STATE.folderId],
    mimeType: 'application/json'
  };

  const boundary = 'foo_bar_baz';
  const metadataPart = JSON.stringify(fileMetadata);
  const mediaPart = JSON.stringify({ cards: [], kassenBattleCount: { tag: 0, initial: 0 }, islandDetected: false, missionsAchieved: [], lastLaunchDate: null, launchStreak: 0, returnAfterGapDetected: false, usedAlphabetSort: false, usedNewestSortAfterAlphabet: false, duelBattleCount: 0 }); // 空の名刺リスト

  const multipartBody = 
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadataPart}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${mediaPart}\r\n` +
    `--${boundary}--`;

  const createRes = await driveFetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  const createdFile = await createRes.json();
  return createdFile.id;
}

// metadata.json をダウンロードして読み込み
async function loadMetadata() {
  const res = await driveFetch(`${DRIVE_API_BASE}/files/${STATE.metadataFileId}?alt=media`);
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data)) {
      // 旧形式（名刺配列のみ）。合戦数はこの端末のlocalStorageに残っていれば一度だけ引き継ぐ
      STATE.cards = data;
      STATE.kassenBattleCount = readLegacyLocalBattleCount();
      STATE.islandDetected = false;
      STATE.missionsAchieved = new Set();
      STATE.lastLaunchDate = null;
      STATE.launchStreak = 0;
      STATE.returnAfterGapDetected = false;
      STATE.usedAlphabetSort = false;
      STATE.usedNewestSortAfterAlphabet = false;
      STATE.duelBattleCount = 0;
    } else {
      STATE.cards = data.cards || [];
      STATE.kassenBattleCount = normalizeKassenBattleCount(data.kassenBattleCount);
      STATE.islandDetected = !!data.islandDetected;
      STATE.missionsAchieved = new Set(Array.isArray(data.missionsAchieved) ? data.missionsAchieved : []);
      STATE.lastLaunchDate = data.lastLaunchDate || null;
      STATE.launchStreak = data.launchStreak || 0;
      STATE.returnAfterGapDetected = !!data.returnAfterGapDetected;
      STATE.usedAlphabetSort = !!data.usedAlphabetSort;
      STATE.usedNewestSortAfterAlphabet = !!data.usedNewestSortAfterAlphabet;
      STATE.duelBattleCount = data.duelBattleCount || 0;
    }
  } else {
    throw new Error('Failed to load metadata');
  }
}

// 旧バージョン（合戦数をlocalStorageのみに保存していた頃）からの一度きりの移行用
function readLegacyLocalBattleCount() {
  try {
    const raw = JSON.parse(localStorage.getItem('kassenBattleCount') || 'null');
    return normalizeKassenBattleCount(raw);
  } catch (e) {
    return { tag: 0, initial: 0 };
  }
}

function normalizeKassenBattleCount(raw) {
  if (raw && typeof raw === 'object') return { tag: raw.tag || 0, initial: raw.initial || 0 };
  if (typeof raw === 'number') return { tag: raw, initial: 0 }; // さらに古い（モード区別なしの合算値）形式
  return { tag: 0, initial: 0 };
}

// metadata.json をドライブに保存（名刺データと合戦数をまとめて保存する）
async function saveMetadata() {
  const res = await driveFetch(`${DRIVE_UPLOAD_BASE}/files/${STATE.metadataFileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cards: STATE.cards,
      kassenBattleCount: STATE.kassenBattleCount,
      islandDetected: STATE.islandDetected,
      missionsAchieved: [...STATE.missionsAchieved],
      lastLaunchDate: STATE.lastLaunchDate,
      launchStreak: STATE.launchStreak,
      returnAfterGapDetected: STATE.returnAfterGapDetected,
      usedAlphabetSort: STATE.usedAlphabetSort,
      usedNewestSortAfterAlphabet: STATE.usedNewestSortAfterAlphabet,
      duelBattleCount: STATE.duelBattleCount,
    })
  });
  return res.ok;
}

// 名刺画像のアップロード
async function uploadImageToDrive(fileBlob, filename) {
  const fileMetadata = {
    name: filename,
    parents: [STATE.folderId],
    mimeType: fileBlob.type
  };

  const boundary = 'image_upload_boundary';
  const metadataPart = JSON.stringify(fileMetadata);
  
  // ArrayBufferに変換してマルチパート送信
  const arrayBuffer = await fileBlob.arrayBuffer();
  const mediaBytes = new Uint8Array(arrayBuffer);

  const header = 
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadataPart}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${fileBlob.type}\r\n\r\n`;

  const footer = `\r\n--${boundary}--`;
  
  // バッファの結合
  const headerBytes = new TextEncoder().encode(header);
  const footerBytes = new TextEncoder().encode(footer);
  
  const totalLength = headerBytes.length + mediaBytes.length + footerBytes.length;
  const multipartBodyBytes = new Uint8Array(totalLength);
  
  multipartBodyBytes.set(headerBytes, 0);
  multipartBodyBytes.set(mediaBytes, headerBytes.length);
  multipartBodyBytes.set(footerBytes, headerBytes.length + mediaBytes.length);

  const uploadRes = await driveFetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBodyBytes
  });

  if (!uploadRes.ok) {
    throw new Error('Image upload failed');
  }

  const fileData = await uploadRes.json();
  return fileData.id; // Google DriveのファイルID
}

// ドライブから画像Blobを安全にフェッチしてキャッシュする
async function fetchCardImage(fileId) {
  if (STATE.imageCache[fileId]) {
    return STATE.imageCache[fileId];
  }

  try {
    const res = await driveFetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`);
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      STATE.imageCache[fileId] = blobUrl;
      return blobUrl;
    }
  } catch (error) {
    console.error('Image fetch error:', error);
  }
  return ''; // 失敗時は空文字
}

// -------------------------------------------------------------
// BUSINESS CARD CARD VIEWER (SWIPE CAROUSEL)
// -------------------------------------------------------------
let currentSwipeIndex = 0;

function renderApp() {
  filterCards();
  renderFilters();
  renderCards();
  updateMissionsGlow();
}

// 並べ替えボタンのツールチップ表示を現在のモードに合わせて更新
function updateSortButtonUI() {
  elements.btnSort.title = STATE.sortMode === 'alphabet'
    ? t('titleSortAlphabet')
    : t('titleSortNewest');
}

// 並べ替えボタン押下時、現在の並べ替えモードを画面中央に一瞬表示する
let sortModePopupTimeout;
function showSortModePopup() {
  const isAlphabet = STATE.sortMode === 'alphabet';
  elements.sortModePopupTitle.textContent = t(isAlphabet ? 'sortPopupAlphabetTitle' : 'sortPopupNewestTitle');

  // 名刺画像（読み込み中のスピナーが出る部分）の位置に合わせて表示位置を調整。
  // 画像エリアの高さはタグ数やメモの有無で名刺ごとに変わってしまうため、
  // 高さに影響されない画像エリアの上端を基準に、固定オフセットで狙う
  const activeCard = elements.cardDeck.querySelectorAll('.business-card')[currentSwipeIndex];
  const imageWrapper = activeCard && activeCard.querySelector('.card-image-wrapper');
  const targetRect = (imageWrapper || elements.cardDeck).getBoundingClientRect();
  const containerRect = elements.sortModePopup.offsetParent.getBoundingClientRect();
  const SORT_POPUP_OFFSET_FROM_IMAGE_TOP = 140;
  elements.sortModePopup.style.top = `${targetRect.top - containerRect.top + SORT_POPUP_OFFSET_FROM_IMAGE_TOP}px`;

  clearTimeout(sortModePopupTimeout);
  elements.sortModePopup.classList.add('active');
  sortModePopupTimeout = setTimeout(() => {
    elements.sortModePopup.classList.remove('active');
  }, 1200);
}

// 並べ替えミッション用の記録を更新する
// 「登録順に並べ替え」は、一度アルファベット順にしてから登録順へ戻した場合のみ達成とする
function trackSortMissionProgress() {
  let changed = false;
  if (STATE.sortMode === 'alphabet' && !STATE.usedAlphabetSort) {
    STATE.usedAlphabetSort = true;
    changed = true;
  }
  if (STATE.sortMode === 'newest' && STATE.usedAlphabetSort && !STATE.usedNewestSortAfterAlphabet) {
    STATE.usedNewestSortAfterAlphabet = true;
    changed = true;
  }
  if (changed) {
    saveMetadata().catch(err => console.error('並べ替えミッションの記録の保存に失敗しました:', err));
    updateMissionsGlow();
  }
}

function filterCards() {
  const query = elements.searchInput.value.toLowerCase().trim();
  
  STATE.filteredCards = STATE.cards.filter(card => {
    // アルファベット・氏名検索
    const matchQuery = !query || 
      (card.name && card.name.toLowerCase().includes(query)) ||
      (card.alphabet && card.alphabet.toLowerCase().includes(query));
      
    // タグフィルター
    const matchTag = STATE.selectedTag === 'all' || 
      (card.tags && card.tags.includes(STATE.selectedTag));

    return matchQuery && matchTag;
  });

  // 並べ替えボタンで選択中のモードに応じてソート（タグ絞り込み後の範囲内で並べ替える）
  if (STATE.sortMode === 'alphabet') {
    STATE.filteredCards.sort((a, b) =>
      (a.alphabet || '').localeCompare(b.alphabet || '', undefined, { sensitivity: 'base' })
    );
  } else {
    STATE.filteredCards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  currentSwipeIndex = 0; // 検索時は先頭へ戻す
}

function renderFilters() {
  // すべてのタグを抽出
  const allTagsSet = new Set();
  STATE.cards.forEach(card => {
    if (card.tags) card.tags.forEach(tag => allTagsSet.add(tag));
  });

  // 既存のフィルター要素をクリア（「すべて」以外）
  elements.tagFilters.innerHTML = '';
  
  // 「すべて」を追加
  const allBtn = document.createElement('button');
  allBtn.className = `tag-filter-item ${STATE.selectedTag === 'all' ? 'active' : ''}`;
  allBtn.dataset.tag = 'all';
  allBtn.textContent = t('tagAll');
  elements.tagFilters.appendChild(allBtn);

  // タグごとのフィルターを追加
  allTagsSet.forEach(tag => {
    const tagBtn = document.createElement('button');
    tagBtn.className = `tag-filter-item ${STATE.selectedTag === tag ? 'active' : ''}`;
    tagBtn.dataset.tag = tag;
    tagBtn.textContent = tag;
    elements.tagFilters.appendChild(tagBtn);
  });
}

function renderCards() {
  const container = elements.cardDeck;
  container.innerHTML = '';

  if (STATE.filteredCards.length === 0) {
    // 空ステートを表示
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <i data-lucide="inbox" style="width:48px; height:48px; color:var(--text-muted); margin-bottom:12px;"></i>
      <p style="margin-bottom:16px;">${t('emptyNoMatch')}</p>
      <button id="btn-empty-add-action" class="btn btn-primary">
        <i data-lucide="plus"></i>
        <span>${t('emptyAddNew')}</span>
      </button>
    `;
    container.appendChild(emptyState);
    elements.cardIndicator.classList.add('hidden');
    
    // イベント割り当て
    const emptyAddBtn = document.getElementById('btn-empty-add-action');
    if (emptyAddBtn) {
      emptyAddBtn.addEventListener('click', () => {
        resetAddForm();
        showScreen('screen-add');
      });
    }
    lucide.createIcons();
    return;
  }

  elements.cardIndicator.classList.remove('hidden');
  updateIndicator();

  // カード要素を動的に生成して挿入
  STATE.filteredCards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'business-card';
    cardEl.dataset.index = index;

    // 初期状態はローディング風プレースホルダー
    const registeredLabel = formatRegisteredMonth(getCardRegisteredMonth(card));
    cardEl.innerHTML = `
      <div class="card-bg-blur" id="bg-blur-${index}"></div>
      <div class="card-image-wrapper">
        <div class="spinner" style="width:30px; height:30px; border-width:2px; border-top-color:var(--accent-indigo)"></div>
        <img class="card-image hidden" id="card-img-${index}" alt="${card.name}">
      </div>
      <div class="card-info">
        <div class="name-row">
          <div>
            <h3>${escapeHTML(card.name)}</h3>
            <div class="alphabet">${escapeHTML(card.alphabet)}</div>
            ${registeredLabel ? `<div class="card-registered-month"><i data-lucide="calendar"></i>${escapeHTML(registeredLabel)}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-icon btn-edit-card" data-id="${card.id}" style="border:none; background:transparent; color:var(--text-muted);" title="${t('titleEditCard')}">
              <i data-lucide="pencil" style="width:18px; height:18px;"></i>
            </button>
            <button class="btn-icon btn-delete-card" data-id="${card.id}" style="border:none; background:transparent; color:var(--text-muted);" title="${t('titleDeleteCard')}">
              <i data-lucide="trash-2" style="width:18px; height:18px;"></i>
            </button>
          </div>
        </div>
        <div class="card-tags">
          ${card.tags ? card.tags.map(tag => `<span class="card-tag">${escapeHTML(tag)}</span>`).join('') : ''}
        </div>
        ${card.memo ? `<p class="card-memo">${escapeHTML(card.memo)}</p>` : ''}
      </div>
    `;

    container.appendChild(cardEl);
  });

  // 編集アイコンのイベント
  document.querySelectorAll('.btn-edit-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditCard(btn.dataset.id);
    });
  });

  // ゴミ箱アイコンのイベント
  document.querySelectorAll('.btn-delete-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm(t('confirmDelete'))) {
        deleteCard(id);
      }
    });
  });

  lucide.createIcons();
  
  // スワイプ（スクロールスナップ）の同期
  scrollToCard(currentSwipeIndex, false);
  loadVisibleImages();
}

function updateIndicator() {
  elements.cardCounter.textContent = `${currentSwipeIndex + 1} / ${STATE.filteredCards.length}`;
}

// 指定したインデックスのカードにスクロール移動
function scrollToCard(index, smooth = true) {
  const cards = elements.cardDeck.querySelectorAll('.business-card');
  if (cards.length > 0 && cards[index]) {
    const card = cards[index];
    const deckRect = elements.cardDeck.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    // カードの実際の幅・位置を測定し、scroll-snap-align:center と一致する位置を算出
    // （固定幅を仮定した計算だと、max-width制限のあるカード幅やコンテナ幅とズレて隣のカードにスナップしてしまう）
    const targetLeft = elements.cardDeck.scrollLeft
      + (cardRect.left - deckRect.left)
      - (deckRect.width - cardRect.width) / 2;
    elements.cardDeck.scrollTo({
      left: targetLeft,
      behavior: smooth ? 'smooth' : 'auto'
    });
    currentSwipeIndex = index;
    updateIndicator();
  }
}

// カルーセルのスクロールイベント監視（スワイプ完了時のハンドラ）
let scrollTimeout;
elements.cardDeck.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    // 実際に画面中央に来ているカードをDOM位置から判定する
    // （固定幅を仮定した割り算だと、max-width制限のあるカード幅とズレて隣のカードを指してしまう）
    const cards = elements.cardDeck.querySelectorAll('.business-card');
    if (cards.length === 0) return;
    const deckRect = elements.cardDeck.getBoundingClientRect();
    const deckCenter = deckRect.left + deckRect.width / 2;
    let newIndex = currentSwipeIndex;
    let bestDist = Infinity;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const dist = Math.abs((rect.left + rect.width / 2) - deckCenter);
      if (dist < bestDist) {
        bestDist = dist;
        newIndex = i;
      }
    });

    if (newIndex !== currentSwipeIndex) {
      currentSwipeIndex = newIndex;
      updateIndicator();
      loadVisibleImages();
    }
  }, 100); // デバウンス
});

// 現在表示されているカードと、その前後の画像を遅延読み込み
async function loadVisibleImages() {
  const indicesToLoad = [currentSwipeIndex, currentSwipeIndex - 1, currentSwipeIndex + 1];
  
  indicesToLoad.forEach(async (index) => {
    if (index < 0 || index >= STATE.filteredCards.length) return;
    const card = STATE.filteredCards[index];
    
    const imgEl = document.getElementById(`card-img-${index}`);
    const blurEl = document.getElementById(`bg-blur-${index}`);
    
    // すでに読み込み完了している場合はスキップ
    if (!imgEl || imgEl.src) return;

    try {
      const imageUrl = await fetchCardImage(card.imageId);
      if (imageUrl) {
        imgEl.src = imageUrl;
        imgEl.classList.remove('hidden');
        // ローディングスピナーを非表示にするため、ラッパーの子要素のスピナーを削除
        const spinner = imgEl.parentElement.querySelector('.spinner');
        if (spinner) spinner.remove();

        // ぼかし背景をセット
        blurEl.style.backgroundImage = `url(${imageUrl})`;
      }
    } catch (e) {
      console.error('Failed to load card image for index ' + index, e);
    }
  });
}

// 名刺削除処理
async function deleteCard(cardId) {
  showLoading(t('loadingDeleting'));
  try {
    const cardIndex = STATE.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = STATE.cards[cardIndex];

    // 1. Googleドライブから画像ファイルを削除
    if (card.imageId) {
      await driveFetch(`${DRIVE_API_BASE}/files/${card.imageId}`, {
        method: 'DELETE'
      });
      // キャッシュからも削除
      if (STATE.imageCache[card.imageId]) {
        URL.revokeObjectURL(STATE.imageCache[card.imageId]);
        delete STATE.imageCache[card.imageId];
      }
    }

    // 2. メタデータ配列から削除して保存
    STATE.cards.splice(cardIndex, 1);
    await saveMetadata();
    
    hideLoading();
    showToast(t('toastDeleted'));
    renderApp();
  } catch (error) {
    console.error('Delete Card Error:', error);
    hideLoading();
    showToast(t('toastDeleteError'));
  }
}

// 名刺編集画面を開く（既存データをフォームに反映）
async function openEditCard(cardId) {
  const card = STATE.cards.find(c => c.id === cardId);
  if (!card) return;

  resetAddForm();
  STATE.editingCardId = cardId;

  elements.addScreenTitle.textContent = t('addTitleEdit');
  elements.btnSubmitText.textContent = t('submitEdit');

  elements.inputName.value = card.name || '';
  elements.inputAlphabet.value = card.alphabet || '';
  elements.inputRegisteredMonth.value = getCardRegisteredMonth(card);
  elements.inputMemo.value = card.memo || '';
  STATE.addedTags = card.tags ? [...card.tags] : [];
  renderAddedTags();

  if (card.imageId) {
    showLoading(t('loadingImage'));
    const imageUrl = await fetchCardImage(card.imageId);
    hideLoading();
    if (imageUrl) {
      elements.photoPreview.src = imageUrl;
      elements.photoPreview.classList.remove('hidden');
      elements.photoPlaceholder.classList.add('hidden');
    }
  }

  showScreen('screen-add');
}

// -------------------------------------------------------------
// NEW CARD REGISTRATION (新規登録)
// -------------------------------------------------------------
function registerEventListeners() {
  // サインイン画面
  elements.btnLogin.addEventListener('click', handleLogin);
  elements.btnOpenSetup.addEventListener('click', () => {
    elements.inputClientId.value = STATE.clientId;
    showScreen('screen-settings');
  });

  // メイン画面ヘッダー
  elements.btnSync.addEventListener('click', syncWithDrive);
  elements.btnSettings.addEventListener('click', () => {
    updateFolderNameDisplay();
    showScreen('screen-settings');
  });
  elements.btnAddCard.addEventListener('click', () => {
    resetAddForm();
    showScreen('screen-add');
  });

  // 検索・クリア
  elements.searchInput.addEventListener('input', () => {
    if (elements.searchInput.value.length > 0) {
      elements.btnClearSearch.classList.remove('hidden');
    } else {
      elements.btnClearSearch.classList.add('hidden');
    }
    renderApp();
  });
  
  elements.btnClearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.btnClearSearch.classList.add('hidden');
    renderApp();
  });

  // 並べ替え（新しい順 ⇔ アルファベット順をトグル）
  elements.btnSort.addEventListener('click', () => {
    STATE.sortMode = STATE.sortMode === 'newest' ? 'alphabet' : 'newest';
    updateSortButtonUI();
    showSortModePopup();
    trackSortMissionProgress();
    renderApp();
  });

  // タグフィルターの選択
  elements.tagFilters.addEventListener('click', (e) => {
    const item = e.target.closest('.tag-filter-item');
    if (!item) return;
    
    STATE.selectedTag = item.dataset.tag;
    document.querySelectorAll('.tag-filter-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    
    renderApp();
  });

  // カルーセルナビゲーションボタン（左右クリック）
  elements.btnPrevCard.addEventListener('click', () => {
    if (currentSwipeIndex > 0) {
      scrollToCard(currentSwipeIndex - 1);
    }
  });

  elements.btnNextCard.addEventListener('click', () => {
    if (currentSwipeIndex < STATE.filteredCards.length - 1) {
      scrollToCard(currentSwipeIndex + 1);
    }
  });

  // 新規登録：キャンセル
  elements.btnCancelAdd.addEventListener('click', () => {
    resetAddForm();
    showScreen('screen-main');
  });

  // 新規登録：写真撮影・選択トリガー
  elements.photoPreviewWrapper.addEventListener('click', () => elements.inputFile.click());
  elements.btnCapture.addEventListener('click', () => {
    elements.inputFile.removeAttribute('capture');
    elements.inputFile.setAttribute('capture', 'environment'); // アウトカメラ優先
    elements.inputFile.click();
  });
  elements.btnGallery.addEventListener('click', () => {
    elements.inputFile.removeAttribute('capture'); // アルバム選択
    elements.inputFile.click();
  });

  // ファイル選択完了イベント
  elements.inputFile.addEventListener('change', handleFileSelect);

  // 新規登録：タグの追加
  elements.btnAddTag.addEventListener('click', addTagFromInput);
  elements.inputTag.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTagFromInput();
    }
  });

  // 新規登録：追加済みタグの削除（アイコンはlucideが再生成するため委任イベントで検知）
  elements.addedTagsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-tag-btn');
    if (!btn) return;
    removeTag(btn.dataset.tag);
  });

  // 新規登録：送信
  elements.formAddCard.addEventListener('submit', handleAddCardSubmit);

  // 設定：保存
  elements.btnSaveSettings.addEventListener('click', () => {
    const newId = elements.inputClientId.value.trim();
    if (!newId) {
      showToast(t('toastClientIdRequired'));
      return;
    }

    const idChanged = STATE.clientId !== newId;
    STATE.clientId = newId;
    localStorage.setItem('clientId', STATE.clientId);

    showToast(t('toastSettingsSaved'));
    
    if (idChanged) {
      initGoogleAuth();
    }
    
    checkSession();
  });

  // 設定：閉じる
  elements.btnCloseSettings.addEventListener('click', () => {
    checkSession();
  });

  // 設定：言語切替
  elements.langSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-switch-btn');
    if (!btn) return;
    applyLanguage(btn.dataset.lang);
  });

  // アカウント：ログアウト
  elements.btnLogout.addEventListener('click', logout);

  // 設定画面：保存先フォルダの変更
  elements.btnChangeFolder.addEventListener('click', async () => {
    const folder = await openFolderPicker();
    if (!folder) return;

    saveSelectedFolder(folder);
    // フォルダが変わったので、以前のフォルダのmetadata.json参照は破棄して読み直す
    STATE.metadataFileId = '';
    localStorage.removeItem('metadataFileId');
    await syncWithDrive();
  });

  // 設定画面：合戦履歴のリセット（確認ダイアログ）
  elements.btnResetKassenHistory.addEventListener('click', () => {
    elements.kassenResetConfirm.classList.remove('hidden');
  });
  elements.btnResetKassenHistoryNo.addEventListener('click', () => {
    elements.kassenResetConfirm.classList.add('hidden');
  });
  elements.btnResetKassenHistoryYes.addEventListener('click', () => {
    elements.kassenResetConfirm.classList.add('hidden');
    resetKassenHistory();
  });

  // 設定画面：デュエルデータのリセット（確認ダイアログ）
  elements.btnResetDuelHistory.addEventListener('click', () => {
    elements.duelResetConfirm.classList.remove('hidden');
  });
  elements.btnResetDuelHistoryNo.addEventListener('click', () => {
    elements.duelResetConfirm.classList.add('hidden');
  });
  elements.btnResetDuelHistoryYes.addEventListener('click', () => {
    elements.duelResetConfirm.classList.add('hidden');
    resetDuelHistory();
  });

  // ミッション：開く・閉じる
  elements.btnMissions.addEventListener('click', openMissionsScreen);
  elements.btnCloseMissions.addEventListener('click', () => {
    showScreen('screen-main');
  });

  // 合戦モード：開く・閉じる
  elements.btnKassen.addEventListener('click', openKassenMode);
  elements.btnCloseKassen.addEventListener('click', () => {
    showScreen('screen-main');
    updateMissionsGlow();
  });

  // 合戦モード：ランキング表示の切り替え（トグル）
  elements.btnKassenRanking.addEventListener('click', () => {
    showKassenView(STATE.kassenView === 'ranking' ? 'map' : 'ranking');
  });
  elements.btnCloseKassenRanking.addEventListener('click', () => {
    showKassenView('map');
  });
  elements.kassenRankingList.addEventListener('click', (e) => {
    const item = e.target.closest('.kassen-ranking-item');
    if (!item) return;
    goToCardFromKassen(item.dataset.id);
  });

  // 合戦モード：地形再生成（確認ダイアログ）
  elements.btnKassenRegenerate.addEventListener('click', () => {
    elements.kassenRegenerateConfirm.classList.remove('hidden');
  });
  elements.btnKassenRegenerateNo.addEventListener('click', () => {
    elements.kassenRegenerateConfirm.classList.add('hidden');
  });
  elements.btnKassenRegenerateYes.addEventListener('click', () => {
    elements.kassenRegenerateConfirm.classList.add('hidden');
    regenerateKassenTerrain();
  });

  // 合戦モード：タグ／イニシャル切り替え
  elements.kassenModeSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('.kassen-mode-btn');
    if (!btn) return;

    STATE.kassenMode = btn.dataset.mode;
    document.querySelectorAll('.kassen-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    elements.kassenResult.innerHTML = '';
    elements.kassenResult.classList.add('hidden');

    renderKassenMap();
    updateKassenBattleCountDisplay();
    if (STATE.kassenView === 'ranking') renderKassenRanking();
  });

  // 合戦モード：ヘックスをタップすると、その名刺の名前をタップ位置の少し上にポップアップ表示
  elements.kassenMap.addEventListener('click', (e) => {
    const hex = e.target.closest('.kassen-hex');
    if (!hex) return;

    const card = STATE.cards.find(c => c.id === hex.dataset.cardId);
    if (!card) return;

    const wrapperRect = elements.kassenMapWrapper.getBoundingClientRect();
    const x = e.clientX - wrapperRect.left;
    const y = e.clientY - wrapperRect.top;
    showKassenHexPopup(card.name, x, y);
  });

  // 合戦モード：合戦開始
  elements.btnStartKassen.addEventListener('click', startKassen);

  // 合戦モード：実況スキップ
  elements.btnSkipKassen.addEventListener('click', () => {
    kassenSkipRequested = true;
    if (kassenSkipResolver) kassenSkipResolver();
  });

  // デュエルモード：開く・閉じる
  elements.btnDuel.addEventListener('click', openDuelMode);
  elements.btnCloseDuel.addEventListener('click', () => {
    showScreen('screen-main');
    updateMissionsGlow();
  });

  // デュエルモード：ランキング表示の切り替え（トグル）
  elements.btnDuelRanking.addEventListener('click', () => {
    showDuelView(STATE.duelView === 'ranking' ? 'match' : 'ranking');
  });
  elements.btnCloseDuelRanking.addEventListener('click', () => {
    showDuelView('match');
  });
  elements.duelRankingList.addEventListener('click', (e) => {
    const item = e.target.closest('.kassen-ranking-item');
    if (!item) return;
    goToCardFromKassen(item.dataset.id);
  });

  // デュエルモード：デュエル開始・対戦相手再選択
  elements.btnStartDuel.addEventListener('click', startDuel);
  elements.btnDuelReselect.addEventListener('click', spinDuelSlotMachine);
}

function resetAddForm() {
  elements.formAddCard.reset();
  elements.photoPreview.src = '';
  elements.photoPreview.classList.add('hidden');
  elements.photoPlaceholder.classList.remove('hidden');
  elements.inputRegisteredMonth.value = getCurrentYearMonth();
  STATE.addedTags = [];
  STATE.editingCardId = null;
  renderAddedTags();

  elements.addScreenTitle.textContent = t('addTitleNew');
  elements.btnSubmitText.textContent = t('submitNew');
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    elements.photoPreview.src = event.target.result;
    elements.photoPreview.classList.remove('hidden');
    elements.photoPlaceholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function addTagFromInput() {
  const val = elements.inputTag.value.trim();
  if (val && !STATE.addedTags.includes(val)) {
    STATE.addedTags.push(val);
    elements.inputTag.value = '';
    renderAddedTags();
  }
}

function removeTag(tag) {
  STATE.addedTags = STATE.addedTags.filter(t => t !== tag);
  renderAddedTags();
}

function renderAddedTags() {
  elements.addedTagsList.innerHTML = '';
  STATE.addedTags.forEach(tag => {
    const badge = document.createElement('span');
    badge.className = 'added-tag-badge';
    badge.innerHTML = `
      <span>${escapeHTML(tag)}</span>
      <i data-lucide="x" class="remove-tag-btn" data-tag="${tag}"></i>
    `;
    elements.addedTagsList.appendChild(badge);
  });

  renderExistingTagSuggestions();
  lucide.createIcons();
}

// 過去に登録した全名刺から使われているタグを集め、まだ追加していないものを候補として表示
function renderExistingTagSuggestions() {
  const allTagsSet = new Set();
  STATE.cards.forEach(card => {
    if (card.tags) card.tags.forEach(tag => allTagsSet.add(tag));
  });

  const availableTags = [...allTagsSet]
    .filter(tag => !STATE.addedTags.includes(tag))
    .sort((a, b) => a.localeCompare(b, 'ja'));

  elements.existingTagsList.innerHTML = '';

  if (availableTags.length === 0) {
    elements.existingTagsSection.classList.add('hidden');
    return;
  }

  elements.existingTagsSection.classList.remove('hidden');
  availableTags.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'existing-tag-chip';
    chip.textContent = tag;
    chip.addEventListener('click', () => addExistingTag(tag));
    elements.existingTagsList.appendChild(chip);
  });
}

// 既存タグ候補をクリックしたときの追加処理
function addExistingTag(tag) {
  if (!STATE.addedTags.includes(tag)) {
    STATE.addedTags.push(tag);
    renderAddedTags();
  }
}

// 新規登録・編集送信（画像アップロード＆メタデータ保存）
async function handleAddCardSubmit(e) {
  e.preventDefault();

  const isEditing = !!STATE.editingCardId;
  const file = elements.inputFile.files[0];

  // 新規登録時のみ画像は必須（編集時は既存画像を維持できる）
  if (!isEditing && !file && !elements.photoPreview.src) {
    showToast(t('toastImageRequired'));
    return;
  }

  showLoading(isEditing ? t('loadingSavingEdit') : t('loadingSavingNew'));

  try {
    const name = elements.inputName.value.trim();
    const alphabet = elements.inputAlphabet.value.trim();
    const registeredMonth = elements.inputRegisteredMonth.value || getCurrentYearMonth();
    const memo = elements.inputMemo.value.trim();
    const tags = [...STATE.addedTags];

    if (isEditing) {
      const cardIndex = STATE.cards.findIndex(c => c.id === STATE.editingCardId);
      if (cardIndex === -1) {
        throw new Error('編集対象の名刺が見つかりません');
      }

      const targetCard = STATE.cards[cardIndex];
      let imageId = targetCard.imageId;

      // 新しい画像が選択されている場合のみ差し替え
      if (file) {
        imageId = await uploadImageToDrive(file, `${targetCard.id}.jpg`);

        if (targetCard.imageId) {
          await driveFetch(`${DRIVE_API_BASE}/files/${targetCard.imageId}`, { method: 'DELETE' });
          if (STATE.imageCache[targetCard.imageId]) {
            URL.revokeObjectURL(STATE.imageCache[targetCard.imageId]);
            delete STATE.imageCache[targetCard.imageId];
          }
        }
      }

      // 合戦マップの座標はここでは変更しない。既存の所属軍の座標はそのまま維持され、
      // タグの追加・削除で所属軍が変わった分は、次に合戦モードを開いたときに
      // ensureKassenPositions() が自動で座標の追加・削除を行う。
      STATE.cards[cardIndex] = { ...targetCard, name, alphabet, registeredMonth, memo, tags, imageId };

      const saveSuccess = await saveMetadata();
      if (!saveSuccess) {
        throw new Error('Failed to update metadata.json');
      }

      showToast(t('toastUpdated'));
    } else {
      let fileBlob = file;
      // ファイル選択でなくプレビューがある（例えば一部ブラウザで引き継がれた場合などの念のため）
      if (!fileBlob && elements.photoPreview.src.startsWith('data:')) {
        fileBlob = dataURLtoBlob(elements.photoPreview.src);
      }

      if (!fileBlob) {
        throw new Error('No valid image file');
      }

      const cardId = 'card_' + Date.now();
      const driveImageId = await uploadImageToDrive(fileBlob, `${cardId}.jpg`);

      const newCard = {
        id: cardId,
        name,
        alphabet,
        registeredMonth,
        memo,
        tags,
        imageId: driveImageId,
        createdAt: new Date().toISOString(),
        kassenPos: { tag: {}, initial: {} }
      };
      // 合戦マップ上の陣地を確定（同タグ・同イニシャルの陣地に隣接するマスへ配置）。
      // 持っているタグの数だけ、それぞれの陣地に別のマスとして配備される（上限なし）。
      getKassenTeamKeys(newCard, 'tag').forEach(team => {
        newCard.kassenPos.tag[team] = computeKassenCell(newCard, 'tag', team);
      });
      getKassenTeamKeys(newCard, 'initial').forEach(team => {
        newCard.kassenPos.initial[team] = computeKassenCell(newCard, 'initial', team);
      });

      STATE.cards.push(newCard);
      const saveSuccess = await saveMetadata();
      if (!saveSuccess) {
        throw new Error('Failed to update metadata.json');
      }

      showToast(t('toastRegistered'));
    }

    resetAddForm();
    showScreen('screen-main');
    renderApp();

  } catch (error) {
    console.error('Card Save Error:', error);
    showToast(isEditing ? t('toastUpdateError') : t('toastRegisterError'));
  } finally {
    hideLoading();
  }
}

// -------------------------------------------------------------
// KASSEN MODE（合戦モード・完全ユーモア機能）
// -------------------------------------------------------------
const KASSEN_PALETTE = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
  '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#facc15',
  '#4ade80', '#38bdf8'
];
const KASSEN_NEUTRAL_COLOR = '#64748b';
// 「無所属」「イニシャル不明」を表す内部識別子（言語に依存しない固定値。表示時のみ翻訳する）
const KASSEN_UNAFFILIATED_KEY = '__unaffiliated__';
const KASSEN_UNKNOWN_INITIAL_KEY = '?';
const KASSEN_NEUTRAL_KEYS = [KASSEN_UNAFFILIATED_KEY, KASSEN_UNKNOWN_INITIAL_KEY];

// axial座標の6方向（フラットトップ六角形）
const HEX_DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

// -------------------------------------------------------------
// MISSIONS（名刺登録数・タグ登録数・合戦数・イニシャル制覇に応じたミッション達成）
// カテゴリー分けは表示せず、あえて種類の分からない一つのリストとして並べることで
// 「？」を開けるまで何のミッションか分からないミステリアスな体験にする
// -------------------------------------------------------------
function getUniqueTagCount() {
  const tagSet = new Set();
  STATE.cards.forEach(card => {
    if (card.tags) card.tags.forEach(tag => tagSet.add(tag));
  });
  return tagSet.size;
}

// タグモードの地図に配備されるヘックスの総数（複数タグを持つ名刺は複数ヘックス分カウントされる）
function getTagModeHexCount() {
  return STATE.cards.reduce((sum, card) => sum + getKassenTeamKeys(card, 'tag').length, 0);
}

// メモが入力されている／されていない名刺の枚数
function getCardsWithMemoCount() {
  return STATE.cards.filter(card => card.memo && card.memo.trim()).length;
}
function getCardsWithoutMemoCount() {
  return STATE.cards.filter(card => !card.memo || !card.memo.trim()).length;
}

// 登録名刺のアルファベットの頭文字（A〜Z）のうち、何種類を制覇したか
function getUniqueInitialCount() {
  const initialSet = new Set();
  STATE.cards.forEach(card => {
    const initial = (card.alphabet || '').trim().charAt(0).toUpperCase();
    if (initial >= 'A' && initial <= 'Z') initialSet.add(initial);
  });
  return initialSet.size;
}

const MISSION_BASE_CATEGORIES = [
  {
    key: 'cards',
    thresholds: [1, 5, 10, 25, 50, 75, 100, 200, 500],
    getCount: () => STATE.cards.length,
    getThresholdLabel: threshold => t('missionThreshold', { count: threshold }),
  },
  {
    key: 'cardsWithMemo',
    thresholds: [10],
    getCount: () => getCardsWithMemoCount(),
    getThresholdLabel: () => t('missionCardsWithMemo10'),
  },
  {
    key: 'cardsWithoutMemo',
    thresholds: [10],
    getCount: () => getCardsWithoutMemoCount(),
    getThresholdLabel: () => t('missionCardsWithoutMemo10'),
  },
  {
    // タグは登録数自体に上限を設けていないが、ミッションの達成ラインは最大50種類までとする
    key: 'tags',
    thresholds: [1, 5, 10, 15, 20, 30, 40, 50],
    getCount: () => getUniqueTagCount(),
    getThresholdLabel: threshold => t('missionThresholdTags', { count: threshold }),
  },
  {
    // 1枚の名刺に付けられたタグ数の最大値（3つ・5つ以上のタグを持つ名刺を登録したか）
    key: 'maxTagsOnCard',
    thresholds: [3, 5],
    getCount: () => STATE.cards.reduce((max, card) => Math.max(max, (card.tags || []).length), 0),
    getThresholdLabel: threshold => t('missionMaxTagsOnCard', { count: threshold }),
  },
  {
    key: 'tagBattles',
    thresholds: [1, 5, 10, 25, 50],
    getCount: () => getKassenBattleCount('tag'),
    getThresholdLabel: threshold => t('missionThresholdTagBattles', { count: threshold }),
    lockedStatusKey: 'missionLockedBattle',
  },
  {
    // タグモードで、最もポイントを稼いだ名刺のポイント数
    key: 'tagMaxPoints',
    thresholds: [10, 20],
    getCount: () => STATE.cards.reduce((max, card) => Math.max(max, getCardMvpCount(card, 'tag')), 0),
    getThresholdLabel: threshold => t('missionMaxPointsTag', { count: threshold }),
    lockedStatusKey: 'missionLockedBattle',
  },
  {
    key: 'initialBattles',
    thresholds: [1, 5, 10, 25, 50],
    getCount: () => getKassenBattleCount('initial'),
    getThresholdLabel: threshold => t('missionThresholdInitialBattles', { count: threshold }),
    lockedStatusKey: 'missionLockedBattle',
  },
  {
    // イニシャルモードで、最もポイントを稼いだ名刺のポイント数
    key: 'initialMaxPoints',
    thresholds: [10, 20],
    getCount: () => STATE.cards.reduce((max, card) => Math.max(max, getCardMvpCount(card, 'initial')), 0),
    getThresholdLabel: threshold => t('missionMaxPointsInitial', { count: threshold }),
    lockedStatusKey: 'missionLockedBattle',
  },
  {
    key: 'duelBattles',
    thresholds: [1, 5, 10, 25, 50],
    getCount: () => STATE.duelBattleCount || 0,
    getThresholdLabel: threshold => t('missionThresholdDuelBattles', { count: threshold }),
    lockedStatusKey: 'missionLockedDuel',
  },
  {
    // デュエルモードで、最もポイントを稼いだ名刺のポイント数
    key: 'duelMaxPoints',
    thresholds: [10, 20],
    getCount: () => STATE.cards.reduce((max, card) => Math.max(max, getCardDuelPoints(card)), 0),
    getThresholdLabel: threshold => t('missionMaxPointsDuel', { count: threshold }),
    lockedStatusKey: 'missionLockedDuel',
  },
  {
    // タグモードの地図上のヘックス総数（複数タグ持ちの名刺は複数ヘックスとしてカウントされる）
    key: 'hexCount',
    thresholds: [100],
    getCount: () => getTagModeHexCount(),
    getThresholdLabel: () => t('missionHexCount100'),
  },
  {
    // マップに孤島（どのヘックスにも接していない配備）が一度でも発生したか
    key: 'island',
    thresholds: [1],
    getCount: () => (STATE.islandDetected ? 1 : 0),
    getThresholdLabel: () => t('missionIslandDetected'),
  },
  {
    // イニシャルアルファベット制覇：10個、50%（13文字）、100%（26文字）
    key: 'alphabet',
    thresholds: [10, 13, 26],
    getCount: () => getUniqueInitialCount(),
    getThresholdLabel: threshold => {
      if (threshold >= 26) return t('missionAlphabetFull');
      if (threshold === 13) return t('missionAlphabetHalf');
      return t('missionAlphabetCount', { count: threshold });
    },
  },
  {
    // 一度でもアルファベット順に並べ替えたか
    key: 'sortAlphabet',
    thresholds: [1],
    getCount: () => (STATE.usedAlphabetSort ? 1 : 0),
    getThresholdLabel: () => t('missionSortAlphabet'),
  },
  {
    // アルファベット順に並べ替えた後、登録順に戻したことがあるか
    key: 'sortNewestAfterAlphabet',
    thresholds: [1],
    getCount: () => (STATE.usedNewestSortAfterAlphabet ? 1 : 0),
    getThresholdLabel: () => t('missionSortNewestAfterAlphabet'),
  },
  {
    // 3日連続でアプリを起動したか
    key: 'launchStreak',
    thresholds: [3],
    getCount: () => STATE.launchStreak,
    getThresholdLabel: () => t('missionLaunchStreak3'),
  },
  {
    // 3日以上の間隔をあけてから起動したことが一度でもあるか
    key: 'returnAfterGap',
    thresholds: [1],
    getCount: () => (STATE.returnAfterGapDetected ? 1 : 0),
    getThresholdLabel: () => t('missionReturnAfterGap3'),
  },
];

// 上記すべてのミッションが達成された数（コンプリートミッション自身は含まない）
const MISSION_BASE_TOTAL = MISSION_BASE_CATEGORIES.reduce((sum, c) => sum + c.thresholds.length, 0);
function getAchievedBaseMissionCount() {
  return MISSION_BASE_CATEGORIES.reduce((sum, category) => {
    const count = category.getCount();
    return sum + category.thresholds.filter(th => count >= th || STATE.missionsAchieved.has(missionId(category.key, th))).length;
  }, 0);
}

const MISSION_CATEGORIES = [
  ...MISSION_BASE_CATEGORIES,
  {
    // 他の全ミッションを達成すると解放される、最後の総仕上げミッション
    key: 'completionist',
    thresholds: [MISSION_BASE_TOTAL],
    getCount: () => getAchievedBaseMissionCount(),
    getThresholdLabel: () => t('missionCompleteAll'),
    achievedStatusKey: 'missionThanks',
  },
];

function missionId(categoryKey, threshold) {
  return `${categoryKey}-${threshold}`;
}

function saveMissionsSeen() {
  localStorage.setItem('missionsSeen', JSON.stringify([...STATE.missionsSeen]));
}

// 見出しは表示しないが、並び順自体はカテゴリーごとにまとめる
function getAllMissions() {
  const merged = [];
  MISSION_CATEGORIES.forEach(category => {
    const count = category.getCount();
    category.thresholds.forEach(threshold => {
      const id = missionId(category.key, threshold);
      merged.push({
        id,
        threshold,
        category,
        achieved: count >= threshold || STATE.missionsAchieved.has(id),
      });
    });
  });
  return merged;
}

// ライブの達成状況を永続化する。一度達成したミッションは、後で条件を満たさなくなっても達成済みのまま保持する
function persistAchievedMissions() {
  let changed = false;
  getAllMissions().forEach(mission => {
    if (mission.achieved && !STATE.missionsAchieved.has(mission.id)) {
      STATE.missionsAchieved.add(mission.id);
      changed = true;
    }
  });
  if (changed) {
    saveMetadata().catch(err => console.error('ミッション達成状況の保存に失敗しました:', err));
  }
}

// 起動日ミッション用の記録を更新する。同じ日に何度同期しても二重カウントしない
function trackAppLaunch() {
  const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  if (STATE.lastLaunchDate === todayStr) return;

  if (STATE.lastLaunchDate) {
    const prevDate = new Date(`${STATE.lastLaunchDate}T00:00:00Z`);
    const todayDate = new Date(`${todayStr}T00:00:00Z`);
    const gapDays = Math.round((todayDate - prevDate) / 86400000);

    STATE.launchStreak = gapDays === 1 ? STATE.launchStreak + 1 : 1;
    if (gapDays >= 3) STATE.returnAfterGapDetected = true;
  } else {
    STATE.launchStreak = 1;
  }

  STATE.lastLaunchDate = todayStr;
  saveMetadata().catch(err => console.error('起動記録の保存に失敗しました:', err));
  updateMissionsGlow();
}

// 達成済みだが、まだミッション画面で「？」から達成内容へめくる演出を見せていないミッション
function getNewlyAchievedMissions() {
  return getAllMissions().filter(m => m.achieved && !STATE.missionsSeen.has(m.id));
}

// トップ画面の「ミッション」ボタンを、未確認の達成があるときだけ発光させる
function updateMissionsGlow() {
  persistAchievedMissions();
  if (!elements.btnMissions) return;
  elements.btnMissions.classList.toggle('mission-glow', getNewlyAchievedMissions().length > 0);
}

function openMissionsScreen() {
  renderMissions();
  showScreen('screen-missions');
}

function renderMissions() {
  const missions = getAllMissions();
  const newlyAchieved = missions.filter(m => m.achieved && !STATE.missionsSeen.has(m.id));

  elements.missionsList.innerHTML = missions.map(mission => {
    const revealed = mission.achieved && STATE.missionsSeen.has(mission.id);
    return `
      <div class="mission-item${revealed ? ' mission-achieved' : ''}" data-mission-id="${mission.id}">
        <div class="mission-icon">${revealed ? '<i data-lucide="check-circle-2"></i>' : '<span class="mission-question">？</span>'}</div>
        <div class="mission-info">
          <div class="mission-title">${revealed ? mission.category.getThresholdLabel(mission.threshold) : t('missionMystery')}</div>
          <div class="mission-status">${revealed ? t(mission.category.achievedStatusKey || 'missionAchieved') : t(mission.category.lockedStatusKey || 'missionLocked')}</div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();

  if (newlyAchieved.length > 0) revealNewMissions(newlyAchieved);
}

// 新規達成したミッションを、少し間を置きながら順番に光らせて「？」から達成内容へめくる
function revealNewMissions(missions) {
  missions.forEach((mission, i) => {
    setTimeout(() => {
      const item = elements.missionsList.querySelector(`.mission-item[data-mission-id="${mission.id}"]`);
      if (!item) return;
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.classList.add('mission-revealing');

      setTimeout(() => {
        item.querySelector('.mission-icon').innerHTML = '<i data-lucide="check-circle-2"></i>';
        item.querySelector('.mission-title').textContent = mission.category.getThresholdLabel(mission.threshold);
        item.querySelector('.mission-status').textContent = t(mission.category.achievedStatusKey || 'missionAchieved');
        item.classList.remove('mission-revealing');
        item.classList.add('mission-achieved');
        lucide.createIcons();

        STATE.missionsSeen.add(mission.id);
        saveMissionsSeen();
        updateMissionsGlow();
      }, 900);
    }, i * 400 + 300);
  });
}

function openKassenMode() {
  STATE.kassenMode = 'tag';
  document.querySelectorAll('.kassen-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === 'tag');
  });
  elements.kassenResult.innerHTML = '';
  setKassenControlsDisabled(false);
  showKassenView('map');
  elements.kassenRegenerateConfirm.classList.add('hidden');
  updateKassenBattleCountDisplay();

  renderKassenMap();
  showScreen('screen-kassen');
}

// タグモード／イニシャルモードそれぞれの合戦数・MVP数を独立に扱うためのヘルパー
function getKassenBattleCount(mode) {
  return (STATE.kassenBattleCount && STATE.kassenBattleCount[mode]) || 0;
}

// card.mvpCount はMVP獲得「回数」ではなく、獲得ポイントの累計値（pt）を保持する
function getCardMvpCount(card, mode) {
  if (card.mvpCount && typeof card.mvpCount === 'object') {
    return card.mvpCount[mode] || 0;
  }
  // 旧形式（モード区別なしの合算値）はタグモードの実績として扱う
  return mode === 'tag' ? (card.mvpCount || 0) : 0;
}

// 通常は+1pt、10回記念大会（合戦数が10の倍数）のMVPは+10pt
function incrementCardMvpCount(card, mode, points = 1) {
  if (!card.mvpCount || typeof card.mvpCount !== 'object') {
    const legacy = typeof card.mvpCount === 'number' ? card.mvpCount : 0;
    card.mvpCount = { tag: legacy, initial: 0 };
  }
  card.mvpCount[mode] = (card.mvpCount[mode] || 0) + points;
}

// 合戦履歴（両モードの合戦数・全名刺の両モードのMVP数）をすべて0にリセットする
async function resetKassenHistory() {
  showLoading(t('loadingDefault'));

  STATE.kassenBattleCount = { tag: 0, initial: 0 };
  STATE.cards.forEach(card => { card.mvpCount = { tag: 0, initial: 0 }; });

  const saveSuccess = await saveMetadata();
  hideLoading();

  updateKassenBattleCountDisplay();
  if (STATE.kassenView === 'ranking') renderKassenRanking();

  showToast(saveSuccess ? t('toastKassenHistoryReset') : t('toastKassenResetError'));
}

// デュエルデータ（デュエル数・全名刺のデュエルポイント）をすべて0にリセットする
async function resetDuelHistory() {
  showLoading(t('loadingDefault'));

  STATE.duelBattleCount = 0;
  STATE.cards.forEach(card => { card.duelWinCount = 0; });

  const saveSuccess = await saveMetadata();
  hideLoading();

  updateDuelBattleCountDisplay();
  if (STATE.duelView === 'ranking') renderDuelRanking();

  showToast(saveSuccess ? t('toastDuelHistoryReset') : t('toastDuelResetError'));
}

function updateKassenBattleCountDisplay() {
  elements.kassenBattleCount.textContent = t('kassenBattleCountLabel', { count: getKassenBattleCount(STATE.kassenMode) });
}

// 合戦モード画面内の表示切り替え（'map' = 地図・合戦, 'ranking' = ランキング〔今後実装予定〕）
function showKassenView(view) {
  STATE.kassenView = view;
  const isRanking = view === 'ranking';

  elements.kassenRankingView.classList.toggle('hidden', !isRanking);
  elements.kassenModeSwitch.classList.toggle('hidden', isRanking);
  elements.kassenMapWrapper.classList.toggle('hidden', isRanking);
  elements.kassenLegend.classList.toggle('hidden', isRanking);
  elements.btnStartKassen.classList.toggle('hidden', isRanking);
  if (isRanking) {
    elements.kassenCommentary.classList.add('hidden');
    elements.kassenResult.classList.add('hidden');
    renderKassenRanking();
  }

  elements.btnKassenRanking.classList.toggle('active', isRanking);
  elements.btnKassenRegenerate.disabled = isRanking;
}

// 累計MVP数の降順（同数なら登録年月が古い方、さらに同じならアルファベット順）でランキングを算出する。
// MVP未獲得（0回）の名刺はランキング対象外で、上位20名まで表示する。
function getKassenRanking() {
  const mode = STATE.kassenMode;
  return STATE.cards
    .filter(card => getCardMvpCount(card, mode) >= 1)
    .slice()
    .sort((a, b) => {
      const countDiff = getCardMvpCount(b, mode) - getCardMvpCount(a, mode);
      if (countDiff !== 0) return countDiff;

      const monthA = getCardRegisteredMonth(a);
      const monthB = getCardRegisteredMonth(b);
      if (monthA !== monthB) return monthA.localeCompare(monthB); // 登録年月が古い方が上位

      return (a.alphabet || '').localeCompare(b.alphabet || '', undefined, { sensitivity: 'base' });
    })
    .slice(0, 20);
}

function renderKassenRanking() {
  const mode = STATE.kassenMode;
  const ranking = getKassenRanking();

  if (ranking.length === 0) {
    elements.kassenRankingList.innerHTML = `<p class="kassen-ranking-empty">${t('kassenRankingEmpty')}</p>`;
    return;
  }

  elements.kassenRankingList.innerHTML = ranking.map((card, i) => {
    const rank = i + 1;
    return `
      <button type="button" class="kassen-ranking-item rank-${rank}" data-id="${card.id}">
        <span class="kassen-ranking-rank">${rank === 1 ? '<i data-lucide="crown"></i>' : rank}</span>
        <span class="kassen-ranking-info">
          <span class="kassen-ranking-name">${escapeHTML(card.name)}</span>
          <span class="kassen-ranking-alphabet">${escapeHTML(card.alphabet)}</span>
        </span>
        <span class="kassen-ranking-count">${t('kassenRankingCount', { count: getCardMvpCount(card, mode) })}</span>
      </button>
    `;
  }).join('');
  lucide.createIcons();
}

// カードが所属する軍のキー一覧を返す。タグモードでは、持っている全てのタグそれぞれの軍に所属する
// （上限なし。タグを5つ持っていれば5つの軍を掛け持ちする）。
// イニシャルモードはアルファベットが1つしかないため常に1軍のみ。
function getKassenTeamKeys(card, mode) {
  if (mode === 'tag') {
    if (!card.tags || card.tags.length === 0) return [KASSEN_UNAFFILIATED_KEY];
    return card.tags;
  }
  const initial = (card.alphabet || '').trim().charAt(0).toUpperCase();
  return [initial || KASSEN_UNKNOWN_INITIAL_KEY];
}

// チームキーの表示用ラベルを返す（無所属/不明マーカーのみ現在のUI言語に翻訳し、
// 実際のタグ・イニシャルはユーザーデータなのでそのまま表示する）
function getKassenTeamDisplayLabel(key) {
  if (key === KASSEN_UNAFFILIATED_KEY) return t('kassenUnaffiliated');
  if (key === KASSEN_UNKNOWN_INITIAL_KEY) return t('kassenUnknownInitial');
  return key;
}

// 登録名刺をチームごとにグルーピング（Map<チーム名, カード配列>）。
// 複数タグを持つカードは、所属する全ての軍の配列に重複して含まれる。
function buildKassenTeams(mode) {
  const teamMap = new Map();
  STATE.cards.forEach(card => {
    getKassenTeamKeys(card, mode).forEach(key => {
      if (!teamMap.has(key)) teamMap.set(key, []);
      teamMap.get(key).push(card);
    });
  });
  return teamMap;
}

// チーム名から表示色を決定（無所属/不明は常にグレー、それ以外はパレットを順番に割当）
function getKassenTeamColor(sortedTeamKeys, key) {
  if (KASSEN_NEUTRAL_KEYS.includes(key)) return KASSEN_NEUTRAL_COLOR;
  const coloredKeys = sortedTeamKeys.filter(k => !KASSEN_NEUTRAL_KEYS.includes(k));
  const idx = coloredKeys.indexOf(key);
  return KASSEN_PALETTE[idx % KASSEN_PALETTE.length];
}

// マップ上の全ヘックス（チーム問わず）が1つの陸地としてつながっているかを判定する。
// 開始点から隣接ヘックスをたどれない配備が残れば「孤島」が存在するということ。
function detectKassenIslandExists(deployments) {
  if (deployments.length < 2) return false;

  const cellSet = new Set(deployments.map(d => kassenCellKey(d.pos.q, d.pos.r)));
  const visited = new Set();
  const startKey = kassenCellKey(deployments[0].pos.q, deployments[0].pos.r);
  visited.add(startKey);
  const queue = [deployments[0].pos];

  while (queue.length) {
    const cur = queue.shift();
    HEX_DIRECTIONS.forEach(dir => {
      const nq = cur.q + dir.q;
      const nr = cur.r + dir.r;
      const key = kassenCellKey(nq, nr);
      if (cellSet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push({ q: nq, r: nr });
      }
    });
  }

  return visited.size < cellSet.size;
}

// 一度でも孤島を検出したら、以降は地形を再生成しても達成状態を保持する
function markIslandDetected() {
  if (STATE.islandDetected) return;
  STATE.islandDetected = true;
  saveMetadata().catch(err => console.error('孤島検出の保存に失敗しました:', err));
  updateMissionsGlow();
}

function kassenCellKey(q, r) {
  return `${q},${r}`;
}

function getHexNeighbors(q, r) {
  return HEX_DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
}

// 候補セルの中から、既に自チームの陣地に多く接しているもの（＝凹みを埋める配置）ほど
// 選ばれやすいよう重み付けした上でランダムに選ぶ（厳密な最優先ではなく確率的な傾向）。
// これにより、細い枝が伸びすぎるのを抑えつつも、時々自然な突起ができる程度のバランスにする。
// sameTeamSetが無い場合（新チームの初期配置等）は単純ランダム。
function pickBestCandidate(candidates, sameTeamSet) {
  if (!sameTeamSet || sameTeamSet.size === 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const scored = candidates.map(cell => {
    const touchCount = getHexNeighbors(cell.q, cell.r).filter(n => sameTeamSet.has(kassenCellKey(n.q, n.r))).length;
    return { cell, weight: touchCount + 1 };
  });

  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const s of scored) {
    roll -= s.weight;
    if (roll <= 0) return s.cell;
  }
  return scored[scored.length - 1].cell;
}

// occupied（使用済みセルの集合）を避けつつ、sources（起点となる複数セル）から
// 同時多点BFSで空きセルを探す。同じ近さの候補が複数あれば、自陣への接触数が多いものを優先しつつ
// 同点はランダムに選ぶことで、陣地の輪郭が幾何学的にならず自然な海岸線のようにギザギザになる。
// sourcesが空なら大陸の一番最初の一枚として原点を返す。
function findNextFreeCell(occupied, sources, sameTeamSet) {
  if (sources.length === 0) {
    return { q: 0, r: 0 };
  }

  const visited = new Set(sources.map(s => kassenCellKey(s.q, s.r)));
  let frontier = sources;

  while (frontier.length > 0) {
    const freeAtThisDistance = [];
    const nextFrontier = [];
    for (const cell of frontier) {
      for (const n of getHexNeighbors(cell.q, cell.r)) {
        const key = kassenCellKey(n.q, n.r);
        if (visited.has(key)) continue;
        visited.add(key);
        if (!occupied.has(key)) {
          freeAtThisDistance.push(n);
        } else {
          nextFrontier.push(n);
        }
      }
    }
    if (freeAtThisDistance.length > 0) {
      return pickBestCandidate(freeAtThisDistance, sameTeamSet);
    }
    frontier = nextFrontier;
  }
  return { q: 0, r: 0 }; // 無限グリッドのため理論上到達しない
}

function hexDistanceFromOrigin(q, r) {
  return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
}

// 原点を中心とした半径radiusの輪（リング）を構成する全セルを返す
function hexRingCells(radius) {
  if (radius === 0) return [{ q: 0, r: 0 }];
  const results = [];
  let hex = { q: HEX_DIRECTIONS[4].q * radius, r: HEX_DIRECTIONS[4].r * radius };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push({ ...hex });
      hex = { q: hex.q + HEX_DIRECTIONS[side].q, r: hex.r + HEX_DIRECTIONS[side].r };
    }
  }
  return results;
}

// 既存の大陸の外周から少し離れた場所に、新しい島の種となるセルをランダムに選ぶ
function pickIslandSeed(allCells) {
  const maxRadius = allCells.reduce((max, c) => Math.max(max, hexDistanceFromOrigin(c.q, c.r)), 0);
  const gap = 2 + Math.floor(Math.random() * 3); // 本土から2〜4マス分離す
  const ring = hexRingCells(maxRadius + gap);
  return ring[Math.floor(Math.random() * ring.length)];
}

// 新しいチームが誕生したときに、本土にくっつけるか、離れた新しい島として配置するかの確率
const KASSEN_NEW_TEAM_ISLAND_CHANCE = 0.15;

// 名刺の「1つの配備」（＝1つの軍への所属）を配置するセルを決定する。
// 同じチームの配備が既に地図上にあれば、その隣接マスを優先して選び陣地が繋がって広がるようにする。
// チームが地図上にまだ無ければ、一定確率で大陸の縁にくっつけ、それ以外は少し離れた新しい島として配置する
// （世界地図のように複数の大陸・離島がある見た目にするため）。地図が完全に空なら原点(0,0)を返す。
function computeKassenCell(card, mode, team) {
  const occupied = new Set();
  const teammateCells = [];
  const sameTeamSet = new Set();
  const allCells = [];

  STATE.cards.forEach(other => {
    const otherPosMap = other.kassenPos && other.kassenPos[mode];
    if (!otherPosMap) return;

    Object.keys(otherPosMap).forEach(otherTeam => {
      if (other.id === card.id && otherTeam === team) return; // 計算中の軍への配備自身は除外

      const pos = otherPosMap[otherTeam];
      if (!pos) return;

      const key = kassenCellKey(pos.q, pos.r);
      occupied.add(key);
      allCells.push(pos);
      if (otherTeam === team) {
        teammateCells.push(pos);
        sameTeamSet.add(key);
      }
    });
  });

  if (teammateCells.length > 0) {
    return findNextFreeCell(occupied, teammateCells, sameTeamSet);
  }

  if (allCells.length > 0 && Math.random() < KASSEN_NEW_TEAM_ISLAND_CHANCE) {
    const seed = pickIslandSeed(allCells);
    return findNextFreeCell(occupied, [seed]);
  }

  return findNextFreeCell(occupied, allCells);
}

// 各名刺の座標データを、現在の所属軍（タグ／イニシャル）と一致させる。
// - まだ座標を持たない軍（新しく追加されたタグ、過去データの初回表示など）には座標を割り当てる
// - もう所属していない軍（削除されたタグ等）の座標は取り除く
// - 既存の座標には一切手を触れない（安定して同じ場所に留まる）
// 1件ずつ順番に確定させることで、既存の配備の位置には影響しない。
// 旧バージョン（単一座標形式）のデータが残っていた場合は、ここで新形式に移行する。
// 現在表示中のモードの配置を全て破棄し、renderKassenMap内のensureKassenPositions()に
// 一から再計算させることで、新しいランダム配置の地形を生成する
function regenerateKassenTerrain() {
  const mode = STATE.kassenMode;
  STATE.cards.forEach(card => {
    if (card.kassenPos && card.kassenPos[mode]) {
      card.kassenPos[mode] = {};
    }
  });
  renderKassenMap();
}

function ensureKassenPositions(mode) {
  let changed = false;
  STATE.cards.forEach(card => {
    if (!card.kassenPos || typeof card.kassenPos !== 'object') {
      card.kassenPos = { tag: {}, initial: {} };
      changed = true;
    }
    ['tag', 'initial'].forEach(m => {
      const val = card.kassenPos[m];
      if (!val || typeof val !== 'object' || 'q' in val) {
        card.kassenPos[m] = {}; // 旧形式（{q, r}の単一座標）からの移行
        changed = true;
      }
    });

    const currentTeams = getKassenTeamKeys(card, mode);
    const currentTeamSet = new Set(currentTeams);
    const posMap = card.kassenPos[mode];

    Object.keys(posMap).forEach(team => {
      if (!currentTeamSet.has(team)) {
        delete posMap[team];
        changed = true;
      }
    });

    currentTeams.forEach(team => {
      if (!posMap[team]) {
        posMap[team] = computeKassenCell(card, mode, team);
        changed = true;
      }
    });
  });
  return changed;
}

// axial座標 -> ピクセル座標（フラットトップ六角形）
function hexAxialToPixel(q, r, size) {
  const x = size * 1.5 * q;
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

// フラットトップ六角形の頂点座標の文字列を生成
function hexPolygonPoints(cx, cy, size) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(' ');
}

let kassenPopupTimeout = null;

// タップ位置の少し上に名前ポップアップを表示する。マップ外へはみ出さないよう位置を補正する。
function showKassenHexPopup(name, x, y) {
  const popup = elements.kassenHexPopup;
  const wrapperRect = elements.kassenMapWrapper.getBoundingClientRect();

  popup.textContent = name;
  popup.classList.remove('hidden');

  const offset = 14;
  popup.style.transform = 'translate(-50%, -100%)';
  popup.style.left = `${x}px`;
  popup.style.top = `${y - offset}px`;

  requestAnimationFrame(() => {
    const popupRect = popup.getBoundingClientRect();
    const margin = 6;
    let clampedX = x;
    let clampedY = y - offset;
    let translateY = '-100%';

    const halfWidth = popupRect.width / 2;
    if (clampedX - halfWidth < margin) clampedX = halfWidth + margin;
    if (clampedX + halfWidth > wrapperRect.width - margin) clampedX = wrapperRect.width - halfWidth - margin;

    // 上に十分な余白が無い場合は、タップ位置のすぐ下に表示する
    if (clampedY - popupRect.height < margin) {
      clampedY = y + offset;
      translateY = '0';
    }

    popup.style.transform = `translate(-50%, ${translateY})`;
    popup.style.left = `${clampedX}px`;
    popup.style.top = `${clampedY}px`;
    popup.classList.add('visible');
  });

  clearTimeout(kassenPopupTimeout);
  kassenPopupTimeout = setTimeout(() => {
    popup.classList.remove('visible');
  }, 1800);
}

function hideKassenHexPopup() {
  clearTimeout(kassenPopupTimeout);
  elements.kassenHexPopup.classList.remove('visible');
}

function renderKassenMap() {
  const svg = elements.kassenMap;
  svg.innerHTML = '';
  hideKassenHexPopup();

  const cards = STATE.cards;
  if (cards.length === 0) {
    elements.kassenEmptyState.classList.remove('hidden');
    elements.kassenLegend.innerHTML = '';
    svg.setAttribute('viewBox', '-10 -10 20 20');
    return;
  }
  elements.kassenEmptyState.classList.add('hidden');

  // 座標未割当の名刺（過去データ等）があれば、登録順で確定させて地図に定着させる
  const positionsChanged = ensureKassenPositions(STATE.kassenMode);
  if (positionsChanged) {
    saveMetadata().catch(err => console.error('Kassen座標の保存に失敗しました:', err));
  }

  const teamMap = buildKassenTeams(STATE.kassenMode);
  const teamKeys = [...teamMap.keys()].sort((a, b) => a.localeCompare(b, 'ja'));

  // 名刺ごとに、所属する軍の数だけヘックス（配備）を作る。
  // タグモードで複数タグを持つ名刺は、タグの数だけ（上限なし）地図上に登場する。
  const deployments = [];
  cards.forEach(card => {
    const posMap = card.kassenPos && card.kassenPos[STATE.kassenMode];
    getKassenTeamKeys(card, STATE.kassenMode).forEach(team => {
      const pos = posMap && posMap[team];
      if (pos) deployments.push({ card, team, pos });
    });
  });

  if (detectKassenIslandExists(deployments)) {
    markIslandDetected();
  }

  const hexSize = 6;
  const pixelCoords = deployments.map(d => hexAxialToPixel(d.pos.q, d.pos.r, hexSize));

  const xs = pixelCoords.map(p => p.x);
  const ys = pixelCoords.map(p => p.y);
  const margin = hexSize * 1.4;
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin;
  const maxY = Math.max(...ys) + margin;
  svg.setAttribute('viewBox', `${minX.toFixed(2)} ${minY.toFixed(2)} ${(maxX - minX).toFixed(2)} ${(maxY - minY).toFixed(2)}`);

  deployments.forEach((d, i) => {
    const color = getKassenTeamColor(teamKeys, d.team);
    const { x, y } = pixelCoords[i];

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', hexPolygonPoints(x, y, hexSize * 0.94));
    poly.setAttribute('fill', color);
    poly.setAttribute('fill-opacity', '0.85');
    poly.classList.add('kassen-hex');
    poly.dataset.team = d.team;
    poly.dataset.cardId = d.card.id;

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = t('kassenHexTooltip', { name: d.card.name, team: getKassenTeamDisplayLabel(d.team) });
    poly.appendChild(title);

    svg.appendChild(poly);
  });

  renderKassenLegend(teamMap, teamKeys);
}

function renderKassenLegend(teamMap, teamKeys) {
  elements.kassenLegend.innerHTML = teamKeys.map(key => {
    const color = getKassenTeamColor(teamKeys, key);
    const count = teamMap.get(key).length;
    return `
      <div class="kassen-legend-item" data-team="${escapeHTML(key)}">
        <span class="kassen-legend-dot" style="background:${color}"></span>
        <span class="kassen-legend-label">${escapeHTML(getKassenTeamDisplayLabel(key))}</span>
        <span class="kassen-legend-count">${count}</span>
      </div>
    `;
  }).join('');
}

const KASSEN_NARRATION_STEP_MS = 1800;

let kassenSkipRequested = false;
let kassenSkipResolver = null;

// ms待つが、スキップされた場合は即座に解決される中断可能な待機
function kassenInterruptibleDelay(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      kassenSkipResolver = null;
      resolve();
    }, ms);
    kassenSkipResolver = () => {
      clearTimeout(timer);
      kassenSkipResolver = null;
      resolve();
    };
  });
}

function setKassenControlsDisabled(disabled) {
  document.querySelectorAll('.kassen-mode-btn').forEach(b => { b.disabled = disabled; });
  elements.btnCloseKassen.disabled = disabled;
}

async function startKassen() {
  if (STATE.cards.length === 0) {
    showToast(t('toastNoCardsForKassen'));
    return;
  }

  // これまでの合戦数をカウント（現在のモード＝タグ/イニシャルごとに個別で保存）
  STATE.kassenBattleCount[STATE.kassenMode] = (STATE.kassenBattleCount[STATE.kassenMode] || 0) + 1;
  const battleNumber = STATE.kassenBattleCount[STATE.kassenMode];
  // 100の倍数の合戦は「100回記念大会」（+10pt）、10の倍数（100の倍数を除く）は「10回記念大会」（+5pt）
  const isCentennialBattle = battleNumber % 100 === 0;
  const isAnniversaryBattle = !isCentennialBattle && battleNumber % 10 === 0;
  updateKassenBattleCountDisplay();

  // 前回のハイライト・結果をリセット（再戦時にも使えるように）
  document.querySelectorAll('.kassen-hex').forEach(hex => {
    hex.classList.remove('kassen-hex-winner', 'kassen-hex-loser');
  });
  document.querySelectorAll('.kassen-legend-item').forEach(item => {
    item.classList.remove('kassen-legend-item-loser');
  });
  elements.kassenResult.innerHTML = '';
  elements.kassenResult.classList.add('hidden');
  hideKassenHexPopup();

  const teamMap = buildKassenTeams(STATE.kassenMode);
  const teamKeys = [...teamMap.keys()];

  // シャッフルして脱落順を決定する（最後に残った1チームが勝者）
  for (let i = teamKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [teamKeys[i], teamKeys[j]] = [teamKeys[j], teamKeys[i]];
  }
  const winningTeam = teamKeys[teamKeys.length - 1];
  const eliminationOrder = teamKeys.slice(0, teamKeys.length - 1);

  kassenSkipRequested = false;
  setKassenControlsDisabled(true);
  elements.btnStartKassen.classList.add('hidden');
  elements.kassenCommentaryText.textContent = t('kassenOpening');
  elements.kassenCommentary.classList.remove('hidden');

  await kassenInterruptibleDelay(900);

  for (const team of eliminationOrder) {
    if (kassenSkipRequested) break;

    const members = teamMap.get(team);
    const featured = members[Math.floor(Math.random() * members.length)];
    const templates = t('narrationTemplates');
    const template = templates[Math.floor(Math.random() * templates.length)];
    const teamLabel = getKassenTeamDisplayLabel(team);
    elements.kassenCommentaryText.textContent = template.replace(/\{team\}/g, teamLabel).replace(/\{name\}/g, featured.name);

    document.querySelectorAll('.kassen-hex').forEach(hex => {
      if (hex.dataset.team === team) hex.classList.add('kassen-hex-loser');
    });
    const loserLegendItem = elements.kassenLegend.querySelector(`.kassen-legend-item[data-team="${CSS.escape(team)}"]`);
    if (loserLegendItem) loserLegendItem.classList.add('kassen-legend-item-loser');

    if (kassenSkipRequested) break;
    await kassenInterruptibleDelay(KASSEN_NARRATION_STEP_MS);
  }

  // スキップされた場合も含め、勝者以外は必ず敗退表示に揃える。
  // ヘックス＝配備（1つの所属）と1対1で対応しているため、そのヘックス自身の軍だけで判定すればよい。
  document.querySelectorAll('.kassen-hex').forEach(hex => {
    if (hex.dataset.team === winningTeam) {
      hex.classList.add('kassen-hex-winner');
      hex.classList.remove('kassen-hex-loser');
    } else {
      hex.classList.add('kassen-hex-loser');
    }
  });
  document.querySelectorAll('.kassen-legend-item').forEach(item => {
    item.classList.toggle('kassen-legend-item-loser', item.dataset.team !== winningTeam);
  });

  elements.kassenCommentary.classList.add('hidden');
  elements.btnStartKassen.classList.remove('hidden');
  setKassenControlsDisabled(false);

  const candidates = teamMap.get(winningTeam);
  const mvp = candidates[Math.floor(Math.random() * candidates.length)];

  // MVPポイントを名刺データに記録し、ランキングに反映されるよう保存する（モードごとに個別集計）
  // 通常+1pt、10回記念大会（10の倍数）は+5pt、100回記念大会（100の倍数）は+10pt
  let mvpPoints = 1;
  if (isCentennialBattle) mvpPoints = 10;
  else if (isAnniversaryBattle) mvpPoints = 5;
  incrementCardMvpCount(mvp, STATE.kassenMode, mvpPoints);
  saveMetadata().catch(err => console.error('MVP集計の保存に失敗しました:', err));

  await showKassenResult(winningTeam, mvp, mvpPoints, isAnniversaryBattle, isCentennialBattle);
}

async function showKassenResult(team, mvp, points, isAnniversaryBattle, isCentennialBattle) {
  let imageUrl = '';
  if (mvp.imageId) {
    imageUrl = await fetchCardImage(mvp.imageId);
  }

  elements.kassenResult.innerHTML = `
    <div class="kassen-result-card glass-card">
      <div class="kassen-result-badge">${t('kassenResultBadge', { team: escapeHTML(getKassenTeamDisplayLabel(team)) })}</div>
      ${isCentennialBattle ? `<div class="kassen-anniversary-badge kassen-centennial-badge">${t('kassenCentennialLabel')}</div>` : ''}
      ${isAnniversaryBattle ? `<div class="kassen-anniversary-badge">${t('kassenAnniversaryLabel')}</div>` : ''}
      <button type="button" id="kassen-mvp-link" class="kassen-mvp kassen-mvp-clickable" title="${t('kassenMvpTitle')}">
        <div class="kassen-mvp-image-wrapper">
          ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHTML(mvp.name)}">` : '<i data-lucide="user"></i>'}
        </div>
        <div class="kassen-mvp-info">
          <span class="kassen-mvp-label">${t('kassenMvpLabel')}</span>
          <h3>${escapeHTML(mvp.name)}</h3>
          <div class="alphabet">${escapeHTML(mvp.alphabet)}</div>
        </div>
        <span class="kassen-mvp-points${(isAnniversaryBattle || isCentennialBattle) ? ' kassen-mvp-points-bonus' : ''}">+${points}pt</span>
        <i data-lucide="chevron-right" class="kassen-mvp-arrow"></i>
      </button>
    </div>
  `;
  elements.kassenResult.classList.remove('hidden');
  lucide.createIcons();

  const mvpLink = document.getElementById('kassen-mvp-link');
  if (mvpLink) {
    mvpLink.addEventListener('click', () => goToCardFromKassen(mvp.id));
  }
}

// MVPの名刺タップで合戦モードを抜け、メイン画面でその名刺までスクロールする
function goToCardFromKassen(cardId) {
  showScreen('screen-main');

  elements.searchInput.value = '';
  elements.btnClearSearch.classList.add('hidden');
  STATE.selectedTag = 'all';
  renderApp();

  const index = STATE.filteredCards.findIndex(c => c.id === cardId);
  if (index !== -1) {
    scrollToCard(index, false);
  } else {
    showToast(t('toastCardNotFound'));
  }
}

// -------------------------------------------------------------
// DUEL MODE（ランダムな2枚の名刺を1対1で対戦させる）
// -------------------------------------------------------------
function duelSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// card.duelWinCount はデュエル勝利「回数」ではなく、獲得ポイントの累計値（pt）を保持する
function getCardDuelPoints(card) {
  return card.duelWinCount || 0;
}

// 通常は+1pt、10回記念大会（デュエル数が10の倍数）は+5pt、100回記念大会（100の倍数）は+10pt
function incrementCardDuelPoints(card, points = 1) {
  card.duelWinCount = (card.duelWinCount || 0) + points;
}

function updateDuelBattleCountDisplay() {
  elements.duelBattleCount.textContent = t('duelBattleCountLabel', { count: STATE.duelBattleCount || 0 });
}

// 通算ポイントの降順（同ポイントなら登録年月が古い方、さらに同じならアルファベット順）でランキングを算出する。
// 未獲得（0pt）の名刺はランキング対象外で、上位20名まで表示する。
function getDuelRanking() {
  return STATE.cards
    .filter(card => getCardDuelPoints(card) >= 1)
    .slice()
    .sort((a, b) => {
      const countDiff = getCardDuelPoints(b) - getCardDuelPoints(a);
      if (countDiff !== 0) return countDiff;

      const monthA = getCardRegisteredMonth(a);
      const monthB = getCardRegisteredMonth(b);
      if (monthA !== monthB) return monthA.localeCompare(monthB);

      return (a.alphabet || '').localeCompare(b.alphabet || '', undefined, { sensitivity: 'base' });
    })
    .slice(0, 20);
}

function renderDuelRanking() {
  const ranking = getDuelRanking();

  if (ranking.length === 0) {
    elements.duelRankingList.innerHTML = `<p class="kassen-ranking-empty">${t('duelRankingEmpty')}</p>`;
    return;
  }

  elements.duelRankingList.innerHTML = ranking.map((card, i) => {
    const rank = i + 1;
    return `
      <button type="button" class="kassen-ranking-item rank-${rank}" data-id="${card.id}">
        <span class="kassen-ranking-rank">${rank === 1 ? '<i data-lucide="crown"></i>' : rank}</span>
        <span class="kassen-ranking-info">
          <span class="kassen-ranking-name">${escapeHTML(card.name)}</span>
          <span class="kassen-ranking-alphabet">${escapeHTML(card.alphabet)}</span>
        </span>
        <span class="kassen-ranking-count">${t('duelRankingCount', { count: getCardDuelPoints(card) })}</span>
      </button>
    `;
  }).join('');
  lucide.createIcons();
}

// デュエルモード画面内の表示切り替え（'match' = 対戦画面, 'ranking' = ランキング）
function showDuelView(view) {
  STATE.duelView = view;
  const isRanking = view === 'ranking';
  const notEnoughCards = STATE.cards.length < 2;

  elements.duelRankingView.classList.toggle('hidden', !isRanking);
  elements.duelEmptyState.classList.toggle('hidden', isRanking || !notEnoughCards);
  elements.duelMatch.classList.toggle('hidden', isRanking || notEnoughCards);

  if (isRanking) {
    renderDuelRanking();
  }

  elements.btnDuelRanking.classList.toggle('active', isRanking);
}

function openDuelMode() {
  showDuelView('match');
  updateDuelBattleCountDisplay();
  showScreen('screen-duel');
  if (STATE.cards.length >= 2) spinDuelSlotMachine();
}

function setDuelControlsDisabled(disabled) {
  elements.btnDuelReselect.disabled = disabled;
  elements.btnCloseDuel.disabled = disabled;
}

// 対戦相手候補から重複しない2枚をランダムに選ぶ
function pickTwoRandomCards() {
  if (STATE.cards.length < 2) return null;
  const idx1 = Math.floor(Math.random() * STATE.cards.length);
  let idx2 = Math.floor(Math.random() * (STATE.cards.length - 1));
  if (idx2 >= idx1) idx2 += 1;
  return [STATE.cards[idx1], STATE.cards[idx2]];
}

// スロットマシンのように候補をめまぐるしく切り替えた後、最終的な対戦相手2枚に着地する
function renderDuelFighterSpinning(side, card) {
  const nameEl = side === 'left' ? elements.duelLeftName : elements.duelRightName;
  const imageWrapper = side === 'left' ? elements.duelLeftImageWrapper : elements.duelRightImageWrapper;
  nameEl.textContent = card.name;
  imageWrapper.innerHTML = '<i data-lucide="user"></i>';
  lucide.createIcons();
}

async function renderDuelFighterFinal(side, card) {
  renderDuelFighterSpinning(side, card);
  if (card.imageId) {
    const imageUrl = await fetchCardImage(card.imageId);
    if (imageUrl) {
      const imageWrapper = side === 'left' ? elements.duelLeftImageWrapper : elements.duelRightImageWrapper;
      imageWrapper.innerHTML = `<img src="${imageUrl}" alt="${escapeHTML(card.name)}">`;
    }
  }
}

function resetDuelBar() {
  STATE.duel.netScore = 0;
  updateDuelBar();
}

// バーは常に左＝青／右＝赤で塗り分けられ、境目がその時点の形勢を示す（開始時は50:50）。
// 押し切られると境目が端まで達し、勝った側の色一色になる
function updateDuelBar() {
  const net = STATE.duel.netScore; // -3(右の勝利)〜+3(左の勝利)
  const percent = Math.max(0, Math.min(100, 50 + (net / 3) * 50));
  elements.duelBarFillLeft.style.width = `${percent}%`;
  elements.duelBarFillRight.style.width = `${100 - percent}%`;
}

// 対戦相手選択中／決定時に画面中央へ一瞬（または選択中の間）表示するポップアップ
let duelSelectPopupTimeout;
function showDuelSelectPopup(textKey, autoHideMs) {
  elements.duelSelectPopupTitle.textContent = t(textKey);
  clearTimeout(duelSelectPopupTimeout);
  elements.duelSelectPopup.classList.add('active');
  if (autoHideMs) {
    duelSelectPopupTimeout = setTimeout(() => {
      elements.duelSelectPopup.classList.remove('active');
    }, autoHideMs);
  }
}

async function spinDuelSlotMachine() {
  if (STATE.cards.length < 2) {
    showDuelView('match');
    return;
  }
  elements.duelEmptyState.classList.add('hidden');
  elements.duelMatch.classList.remove('hidden');

  STATE.duel.inProgress = true;
  setDuelControlsDisabled(true);
  elements.btnStartDuel.disabled = true;
  elements.duelResult.classList.add('hidden');
  elements.duelResult.innerHTML = '';
  STATE.duel.winner = null;
  resetDuelBar();

  showDuelSelectPopup('duelSelectingOpponent');

  const spins = 12;
  for (let i = 0; i < spins; i++) {
    const [c1, c2] = pickTwoRandomCards();
    renderDuelFighterSpinning('left', c1);
    renderDuelFighterSpinning('right', c2);
    await duelSleep(60 + i * 12);
  }

  const [finalLeft, finalRight] = pickTwoRandomCards();
  STATE.duel.left = finalLeft;
  STATE.duel.right = finalRight;
  await Promise.all([
    renderDuelFighterFinal('left', finalLeft),
    renderDuelFighterFinal('right', finalRight),
  ]);
  resetDuelBar();

  showDuelSelectPopup('duelOpponentsDecided', 1500);

  STATE.duel.inProgress = false;
  setDuelControlsDisabled(false);
  elements.btnStartDuel.disabled = false;
  elements.btnStartDuel.classList.remove('hidden');
}

async function showDuelResult(winnerCard, points, isAnniversaryDuel, isCentennialDuel) {
  elements.duelResult.innerHTML = `
    <div class="kassen-result-card glass-card">
      <div class="kassen-result-badge">${t('duelResultBadge', { name: escapeHTML(winnerCard.name) })}</div>
      ${isCentennialDuel ? `<div class="kassen-anniversary-badge kassen-centennial-badge">${t('kassenCentennialLabel')}</div>` : ''}
      ${isAnniversaryDuel ? `<div class="kassen-anniversary-badge">${t('kassenAnniversaryLabel')}</div>` : ''}
      <button type="button" id="duel-winner-link" class="kassen-mvp kassen-mvp-clickable" title="${t('kassenMvpTitle')}">
        <div class="kassen-mvp-image-wrapper">
          <i data-lucide="user"></i>
        </div>
        <div class="kassen-mvp-info">
          <span class="kassen-mvp-label">${t('duelWinnerLabel')}</span>
          <h3>${escapeHTML(winnerCard.name)}</h3>
          <div class="alphabet">${escapeHTML(winnerCard.alphabet)}</div>
        </div>
        <span class="kassen-mvp-points${(isAnniversaryDuel || isCentennialDuel) ? ' kassen-mvp-points-bonus' : ''}">+${points}pt</span>
        <i data-lucide="chevron-right" class="kassen-mvp-arrow"></i>
      </button>
    </div>
  `;
  elements.duelResult.classList.remove('hidden');
  lucide.createIcons();

  if (winnerCard.imageId) {
    const imageUrl = await fetchCardImage(winnerCard.imageId);
    if (imageUrl) {
      const imgWrapper = document.querySelector('#duel-result .kassen-mvp-image-wrapper');
      if (imgWrapper) imgWrapper.innerHTML = `<img src="${imageUrl}" alt="${escapeHTML(winnerCard.name)}">`;
    }
  }

  const winnerLink = document.getElementById('duel-winner-link');
  if (winnerLink) {
    winnerLink.addEventListener('click', () => goToCardFromKassen(winnerCard.id));
  }
}

async function startDuel() {
  if (STATE.duel.inProgress || !STATE.duel.left || !STATE.duel.right || STATE.duel.winner) return;

  STATE.duel.inProgress = true;
  elements.btnStartDuel.classList.add('hidden');
  elements.btnDuelReselect.classList.add('hidden');
  setDuelControlsDisabled(true);

  // これまでのデュエル数をカウント。100の倍数は「100回記念大会」（+10pt）、
  // 10の倍数（100の倍数を除く）は「10回記念大会」（+5pt）
  STATE.duelBattleCount = (STATE.duelBattleCount || 0) + 1;
  const battleNumber = STATE.duelBattleCount;
  const isCentennialDuel = battleNumber % 100 === 0;
  const isAnniversaryDuel = !isCentennialDuel && battleNumber % 10 === 0;
  updateDuelBattleCountDisplay();

  elements.duelCommentaryText.textContent = t('duelOpening');
  elements.duelCommentary.classList.remove('hidden');
  await duelSleep(700);

  // 押し合い（相手に押し返されると相殺される）。どちらかがバーの端まで押し切ったら勝利。
  // まれに「必殺技」が発動し、一気に2つ押し込む
  while (Math.abs(STATE.duel.netScore) < 3) {
    const direction = Math.random() < 0.5 ? 1 : -1; // +1 = 左が押す, -1 = 右が押す
    const isSpecialMove = Math.random() < 0.2;
    const magnitude = isSpecialMove ? 2 : 1;
    const actingCard = direction > 0 ? STATE.duel.left : STATE.duel.right;

    const templates = t(isSpecialMove ? 'duelSpecialTemplates' : 'duelNormalTemplates');
    const template = templates[Math.floor(Math.random() * templates.length)];
    elements.duelCommentaryText.textContent = template.replace(/\{name\}/g, actingCard.name);

    STATE.duel.netScore = Math.max(-3, Math.min(3, STATE.duel.netScore + direction * magnitude));
    updateDuelBar();

    await duelSleep(1300);
  }

  elements.duelCommentary.classList.add('hidden');

  const winnerSide = STATE.duel.netScore >= 3 ? 'left' : 'right';
  const winnerCard = winnerSide === 'left' ? STATE.duel.left : STATE.duel.right;
  STATE.duel.winner = winnerSide;

  let points = 1;
  if (isCentennialDuel) points = 10;
  else if (isAnniversaryDuel) points = 5;

  incrementCardDuelPoints(winnerCard, points);
  saveMetadata().catch(err => console.error('デュエル結果の保存に失敗しました:', err));
  if (STATE.duelView === 'ranking') renderDuelRanking();

  await showDuelResult(winnerCard, points, isAnniversaryDuel, isCentennialDuel);

  elements.btnDuelReselect.classList.remove('hidden');
  setDuelControlsDisabled(false);
  STATE.duel.inProgress = false;
}

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------

// 表示言語に関わらず常に同じ形式（例: "Aug. 2026"）で登録年月を表示するための固定表記
const REGISTERED_MONTH_ABBR = [
  'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
  'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
];

// "YYYY-MM" -> "Aug. 2026"（日本語UI・英語UI共通の固定フォーマット）
function formatRegisteredMonth(yyyyMm) {
  if (!yyyyMm) return '';
  const [year, month] = yyyyMm.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return '';
  return `${REGISTERED_MONTH_ABBR[month - 1]} ${year}`;
}

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function deriveYearMonthFromISO(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 明示的に登録年月が保存されていない古いカードは、登録日時(createdAt)から補って表示・編集できるようにする
function getCardRegisteredMonth(card) {
  return card.registeredMonth || deriveYearMonthFromISO(card.createdAt);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

// Service Worker の登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('ServiceWorker registration successful with scope: ', reg.scope))
      .catch(err => console.log('ServiceWorker registration failed: ', err));
  });

  // 新しいService Workerが有効化されたら自動的にページを再読み込みし、
  // 最新版への切り替えを手動での開き直しなしで反映する
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}
