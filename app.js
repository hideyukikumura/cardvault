// -------------------------------------------------------------
// APP CONFIG & STATE
// -------------------------------------------------------------
// アプリ全体で共通のOAuthクライアントID（公開して問題ない値。ユーザーごとの個別設定は不要）
const GOOGLE_OAUTH_CLIENT_ID = '1017755020769-9i4h7g2qgi5q4ipbbntn3fst9a34mct7.apps.googleusercontent.com';

let STATE = {
  clientId: GOOGLE_OAUTH_CLIENT_ID,
  accessToken: localStorage.getItem('accessToken') || '',
  tokenExpiry: parseInt(localStorage.getItem('tokenExpiry') || '0', 10),
  folderId: localStorage.getItem('folderId') || '',
  folderName: localStorage.getItem('folderName') || '', // 保存先フォルダの表示名（Pickerで選択した際に取得）
  metadataFileId: localStorage.getItem('metadataFileId') || '',
  cards: [],          // すべての名刺データ
  filteredCards: [],  // 検索・フィルター後の名刺データ
  selectedTag: 'all', // 現在選択されているフィルタータグ
  sortMode: 'newest', // 一覧の並べ替え基準（'newest' / 'alphabet' / 'yearAsc' / 'yearDesc'）
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
  duelUltimateMoveTriggered: false, // デュエルで押し合いが9回続き、超奥義が発動したことが一度でもあるか（Google Driveに保存）
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
  derbyView: 'match',  // ダービーモード画面内の表示切り替え（'match' or 'ranking'）
  derbyBattleCount: 0, // これまでのダービー開催数（Google Driveに保存）
  // 現在の対戦セッション（画面を開くたびにリセットされる一時状態。Google Driveには保存しない）
  // netScore: -3(右が押し切って勝利)〜+3(左が押し切って勝利)。押し合いなので、相手に押し返されると相殺される
  duel: { left: null, right: null, netScore: 0, winner: null, inProgress: false },
  // ダービーモードで現在抽選されている出走者6名とレース進行状況（画面を開くたびにリセットされる一時状態。Google Driveには保存しない）
  // progress: 各ゲート（出走者インデックス）ごとの周回進捗（0〜1）。finishOrder: ゴールした順にゲートインデックスを記録
  // lateralPos: 「ダイナミック」表示スタイルでの横方向の見た目上の位置（0=インコース〜5=アウトコース、勝敗には無関係）
  // spreadTargets: 終盤に広がる際の、出走者ごとのランダムな目標レーン（レースごとに再抽選）
  derby: { cards: [], progress: [], finishOrder: [], racing: false, lateralPos: [], spreadTargets: [] },
  // 名刺登録上限解除（アプリ内課金）を購入済みかどうか。起動直後はこの端末での直近の確認結果を暫定表示し、
  // checkProEntitlement()でGoogle Play Billingの実際の購入状況に基づいて確定させる
  isPro: localStorage.getItem('isPro') === '1',
  tokenClient: null,  // Google OAuth Token Client
  imageCache: {},     // { fileId: blobUrl }
  user: null          // { name, email, avatarUrl }
};

// Google API endpoint constants
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
// Google Picker API用のAPIキー（HTTPリファラー制限・Picker APIのみに制限済みのため、公開して問題ない）
const GOOGLE_PICKER_API_KEY = 'AIzaSyC9UqDIBywV5jYaT_qjLwB0iEPXXt7SfKM';

// 名刺登録上限のアプリ内課金機能を有効にするかどうか。クローズドテスト中はfalseにして、
// テスターが上限やアップグレード画面に触れず無制限に登録できるようにする。
// 本番公開時にtrueへ戻す
const IAP_ENABLED = false;
// 無料版で登録できる名刺の上限。これを超える新規登録にはアップグレード（アプリ内課金）が必要
const CARD_FREE_LIMIT = 10;
// Google Play Consoleで作成するアプリ内アイテム（名刺登録上限解除）のプロダクトID。
// Play Console側の設定と必ず一致させること
const IAP_UNLOCK_PRODUCT_ID = 'unlock_unlimited_cards';

// -------------------------------------------------------------
// I18N（UIの表示言語のみ切り替える。名刺データ自体は翻訳しない）
// -------------------------------------------------------------
const I18N = {
  ja: {
    pageTitle: 'Cardvalia',
    btnLogin: 'Google アカウントでサインイン',
    authDescIntro: 'Cardvaliaは、いただいた名刺をご自身のGoogleドライブだけで管理できる、名刺管理アプリです。',
    authDescFeature1: '名刺の登録・検索・タグ管理ができます',
    authDescFeature2: 'データはすべて、ご自身のGoogleドライブ内の選択したフォルダに保存されます（開発者のサーバーには一切保存されません）',
    authDescFeature3: '合戦モード・デュエルモードなど、名刺の相手を思い出すための遊び心のある機能もあります',
    linkPrivacyPolicy: 'プライバシーポリシー',

    titleSync: '同期',
    titleAdd: '新規登録',
    titleKassen: '合戦モード',
    titleDuel: 'デュエルモード',
    titleDerby: 'ダービーモード',
    headingDerby: 'ダービーモード',
    derbyEmptyNotEnoughCards: '開催するには名刺が6枚以上必要です',
    btnStartDerby: 'レース開始',
    btnDerbyReselect: '出走者再抽選',
    titleDerbyRanking: 'ランキング',
    headingDerbyRanking: 'ダービー通算ポイントランキング',
    derbyRankingEmpty: 'まだポイントが入っていません',
    derbyRankingCount: '{count}pt',
    derbyBattleCountLabel: 'これまでの開催数: {count}回',
    derbyStartMessage: 'レーススタート！',
    derbyZone1Comment: '第1コーナーを抜け、{name}がトップに立った！',
    derbyZone2Comment: 'コース半ばを通過、{name}が先頭をキープ！',
    derbyZone3Comment: '最終コーナーへ、{name}がトップのまま進む！',
    derbyWinnerTemplates: [
      '🎉 {name}が見事1着でゴール！',
      '👑 {name}、堂々の優勝です！',
      '🏆 圧巻の走り、{name}が1位でフィニッシュ！',
      '✨ {name}が先頭でゴールテープを切りました！',
      '🎊 {name}、有終の美を飾る1着ゴール！',
      '🔥 {name}が最後まで粘り切って優勝！',
      '🌟 {name}、見事な走りで栄冠を手にしました！',
      '🥇 1着は{name}！おめでとうございます！',
      '💫 {name}が他を圧倒してトップでゴール！',
      '🎈 {name}、素晴らしいレースで1着です！'
    ],
    titleMissions: 'ミッション',
    headingMissions: 'ミッション',
    headingUpgrade: 'アップグレード',
    upgradeLimitTitle: '無料版は名刺10枚までです',
    upgradeLimitDesc: 'アップグレードすると、名刺の登録上限がなくなり、何枚でも登録できるようになります。',
    btnUpgradePurchase: 'アップグレード',
    upgradeUnavailableNote: 'この環境では購入機能をご利用いただけません（Playストア版アプリでのみご利用いただけます）',
    toastUpgradeSuccess: 'アップグレードが完了しました。名刺登録の上限がなくなりました！',
    toastUpgradeError: '購入処理中にエラーが発生しました',
    headingUpgradeSection: 'アップグレード',
    btnOpenUpgrade: 'アップグレードして上限解除',
    settingsUpgradeFreeDesc: `現在、名刺登録は${CARD_FREE_LIMIT}枚までの無料版です。`,
    settingsUpgradeProDesc: '✨ アップグレード済みです。名刺は上限なく登録できます。',
    missionThreshold: '{count}枚登録',
    missionDailyRegistration: '1日に{count}枚登録',
    missionCardsWithMemo10: 'メモありで名刺を10枚登録',
    missionCardsWithoutMemo10: 'メモなしで名刺を10枚登録',
    missionThresholdTags: '{count}種類のタグ登録',
    missionMaxTagsOnCard: '{count}つのタグを持った名刺を登録',
    missionThresholdTagBattles: 'タグモードで{count}回合戦',
    missionThresholdInitialBattles: 'イニシャルモードで{count}回合戦',
    missionThresholdDuelBattles: 'デュエルで{count}回対戦',
    missionThresholdDerbyBattles: 'ダービーで{count}回レース',
    missionMaxPointsTag: 'タグモードで{count}pt達成の名刺が出現',
    missionMaxPointsInitial: 'イニシャルモードで{count}pt達成の名刺が出現',
    missionMaxPointsDuel: 'デュエルで{count}pt達成の名刺が出現',
    missionDuelUltimateMove: '超奥義が発動',
    missionMaxPointsDerby: 'ダービーで{count}pt達成の名刺が出現',
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
    missionLockedDerby: 'ダービーをして解放しよう',
    badgeRankOneKassenTag: 'タグ合戦1位',
    badgeRankOneKassenInitial: 'イニシャル合戦1位',
    badgeRankOneDuel: 'デュエル1位',
    badgeRankOneDerby: 'ダービー1位',
    titleSettings: '設定',
    titleSortNewest: '並べ替え：登録が新しい順',
    titleSortAlphabet: '並べ替え：アルファベット順',
    titleSortYearAsc: '並べ替え：年代が古い順',
    titleSortYearDesc: '並べ替え：年代が新しい順',
    sortPopupNewestTitle: '登録順',
    sortPopupAlphabetTitle: 'アルファベット順',
    sortPopupYearAscTitle: '年代昇順',
    sortPopupYearDescTitle: '年代降順',
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
    cropTitle: '写真のトリミング',
    cropHint: '四隅をドラッグして範囲を調整し、内側をドラッグして移動できます',
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
    folderChoiceTitle: '保存先フォルダの選択',
    folderChoiceExisting: '既存のフォルダから選ぶ',
    folderChoiceNew: '新しいフォルダを作成',
    myDriveRootLabel: 'マイドライブ',
    labelNewFolderParent: '作成先：',
    btnChangeParent: '変更',
    placeholderNewFolderName: 'フォルダ名',
    btnCreateFolder: '作成',
    btnCancel: 'キャンセル',
    toastFolderNameRequired: 'フォルダ名を入力してください',
    toastFolderCreateError: 'フォルダの作成に失敗しました',
    headingTagManagement: 'タグの削除',
    tagManagementDesc: '登録済みのタグを削除できます。削除すると、そのタグを持つすべての名刺からタグが外れます。',
    tagManagementEmpty: '削除できるタグがありません',
    confirmDeleteTag: '「{tag}」を削除します。タグを削除するとタグ合戦モードの地形が変わる可能性があります。この操作は戻せません。よろしいですか？',
    toastTagDeleted: '「{tag}」を削除しました',
    toastTagDeleteError: 'タグの削除に失敗しました',
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
    headingAdPrivacy: '広告のプライバシー設定',
    adPrivacyDesc: '広告配信のための同意内容は、いつでも変更できます。',
    btnAdPrivacyOptions: '同意設定を管理',
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
    kassenAnniversaryLabel: '🎉 {count}回記念大会ボーナス！',
    kassenCentennialLabel: '🎊 {count}回記念大会ボーナス！',
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
    // 脱落したチームの陣地を継承した側（陣地拡大チーム）にフィーチャーした実況
    kassenTerritoryTemplates: [
      '{name}の活躍で、{winner}が陣地を広げる！',
      '{winner}が勢いに乗る！立役者は{name}だ！',
      '{name}の奮闘もあり、{winner}の勢力がさらに拡大！',
      '気づけば{winner}の陣地が広がっていた。中心にいたのは{name}。',
      '{name}の活躍が光る中、{winner}が着々と領地を広げていく！'
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
      '{name}、余裕の笑みでリズムを刻む！',
      '{name}、優雅な一礼で場を制す！',
      '{name}が繰り出す、流れるような身のこなし！',
      '{name}の視線ひとつで空気が変わる！',
      '{name}、しなやかな身のこなしで一歩前へ！',
      '{name}が魅せる、静かな貫禄！',
      '{name}、涼しげな表情でリードを奪う！',
      '{name}の指先が奏でる、鮮やかな一手！',
      '{name}、軽やかな足取りで場を沸かせる！',
      '{name}が放つ、洗練された一瞬のきらめき！',
      '{name}、余裕の表情で流れを引き寄せる！'
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
    // 押し合いが9回続いても決着がつかない場合、10回目の代わりに発動する演出
    duelFinalPhase: '最終局面！どっちが勝つか！？',
    duelUltimateTemplates: [
      '🌟 {name}の超奥義「満点の笑顔」が炸裂！',
      '🌟 {name}、渾身の超奥義「万雷の拍手」で場を制した！',
      '🌟 {name}の超奥義「一瞬の静寂」が全てを変えた！',
      '🌟 {name}、超奥義「虹色のため息」を解き放つ！',
      '🌟 {name}の超奥義「星空の祝福」が舞い降りた！',
      '🌟 {name}、超奥義「万感のお辞儀」で場内を魅了！',
      '🌟 {name}の超奥義「奇跡のひとこと」が決まった！',
      '🌟 {name}、超奥義「光の握手」で決着をつけた！',
      '🌟 {name}の超奥義「伝説のウインク」が炸裂！',
      '🌟 {name}、超奥義「永遠の拍手喝采」で勝利をつかんだ！'
    ],

    loadingDefault: '読み込み中...',
    loadingSigningIn: 'Googleでサインイン中...',
    loadingSyncing: 'Googleドライブと同期中...',
    loadingOpeningPicker: 'フォルダ選択ツールを準備中...',
    loadingImage: '画像を読み込み中...',
    loadingDeleting: '名刺を削除中...',
    loadingSavingNew: 'Googleドライブに保存中...',
    loadingSavingEdit: '変更を保存中...',

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
    toastNoCardsForKassen: '名刺が登録されていません',
    toastCardNotFound: '名刺が見つかりませんでした',
    userNoName: 'ユーザー名なし'
  },
  en: {
    pageTitle: 'Cardvalia',
    btnLogin: 'Sign in with Google',
    authDescIntro: 'Cardvalia is a business card manager that stores everything in your own Google Drive.',
    authDescFeature1: 'Register, search, and tag your business cards',
    authDescFeature2: "All data is saved to a folder you choose in your own Google Drive — the developer's servers never store it",
    authDescFeature3: 'Playful extras like Showdown Mode and Duel Mode help you remember who you met',
    linkPrivacyPolicy: 'Privacy Policy',

    titleSync: 'Sync',
    titleAdd: 'Add Card',
    titleKassen: 'Showdown Mode',
    titleDuel: 'Duel Mode',
    titleDerby: 'Derby Mode',
    headingDerby: 'Derby Mode',
    derbyEmptyNotEnoughCards: 'You need at least 6 cards to hold a derby',
    btnStartDerby: 'Start Race',
    btnDerbyReselect: 'Redraw Entrants',
    titleDerbyRanking: 'Ranking',
    headingDerbyRanking: 'Derby Point Ranking',
    derbyRankingEmpty: 'No points yet',
    derbyRankingCount: '{count}pt',
    derbyBattleCountLabel: 'Races held: {count}',
    derbyStartMessage: 'Race start!',
    derbyZone1Comment: 'Out of the first turn, {name} takes the lead!',
    derbyZone2Comment: 'Halfway through the course, {name} stays in front!',
    derbyZone3Comment: 'Into the final turn, {name} is still leading!',
    derbyWinnerTemplates: [
      '🎉 {name} crosses the line in first place!',
      '👑 {name} takes a commanding victory!',
      '🏆 A stunning run — {name} finishes first!',
      '✨ {name} breaks the tape in the lead!',
      '🎊 {name} caps it off with a first-place finish!',
      '🔥 {name} holds on to win it all!',
      '🌟 A brilliant run earns {name} the crown!',
      '🥇 First place goes to {name}! Congratulations!',
      '💫 {name} dominates the field to finish first!',
      '🎈 {name} wins with a fantastic race!'
    ],
    titleMissions: 'Missions',
    headingMissions: 'Missions',
    headingUpgrade: 'Upgrade',
    upgradeLimitTitle: 'The free version is limited to 10 cards',
    upgradeLimitDesc: 'Upgrading removes the card limit, letting you register as many cards as you like.',
    btnUpgradePurchase: 'Upgrade',
    upgradeUnavailableNote: 'Purchases aren\'t available in this environment (only in the Play Store app)',
    toastUpgradeSuccess: 'Upgrade complete. The card limit has been removed!',
    toastUpgradeError: 'An error occurred during the purchase',
    headingUpgradeSection: 'Upgrade',
    btnOpenUpgrade: 'Upgrade to remove the limit',
    settingsUpgradeFreeDesc: `You're currently on the free version, limited to ${CARD_FREE_LIMIT} cards.`,
    settingsUpgradeProDesc: '✨ You\'re upgraded — no card limit.',
    missionThreshold: '{count}-card milestone',
    missionDailyRegistration: 'Register {count} cards in one day',
    missionCardsWithMemo10: 'Register 10 cards with a memo',
    missionCardsWithoutMemo10: 'Register 10 cards without a memo',
    missionThresholdTags: '{count}-tag milestone',
    missionMaxTagsOnCard: 'Register a card with {count}+ tags',
    missionThresholdTagBattles: '{count} Tag Mode battles',
    missionThresholdInitialBattles: '{count} Initial Mode battles',
    missionThresholdDuelBattles: '{count} Duel Mode matches',
    missionThresholdDerbyBattles: '{count} Derby Mode races',
    missionMaxPointsTag: 'A card reaches {count}pt in Tag Mode',
    missionMaxPointsInitial: 'A card reaches {count}pt in Initial Mode',
    missionMaxPointsDuel: 'A card reaches {count}pt in Duel Mode',
    missionDuelUltimateMove: 'The Ultimate Move is unleashed',
    missionMaxPointsDerby: 'A card reaches {count}pt in Derby Mode',
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
    missionLockedDerby: 'Race in Derby Mode to unlock',
    badgeRankOneKassenTag: 'Tag Battle #1',
    badgeRankOneKassenInitial: 'Initial Battle #1',
    badgeRankOneDuel: 'Duel #1',
    badgeRankOneDerby: 'Derby #1',
    titleSettings: 'Settings',
    titleSortNewest: 'Sort: Newest first',
    titleSortAlphabet: 'Sort: Alphabetical',
    titleSortYearAsc: 'Sort: Oldest era first',
    titleSortYearDesc: 'Sort: Newest era first',
    sortPopupNewestTitle: 'Newest First',
    sortPopupAlphabetTitle: 'Alphabetical',
    sortPopupYearAscTitle: 'Era: Ascending',
    sortPopupYearDescTitle: 'Era: Descending',
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
    cropTitle: 'Crop Photo',
    cropHint: 'Drag the corners to adjust the area, or drag inside to move it',
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
    folderChoiceTitle: 'Choose a storage folder',
    folderChoiceExisting: 'Choose an existing folder',
    folderChoiceNew: 'Create a new folder',
    myDriveRootLabel: 'My Drive',
    labelNewFolderParent: 'Location:',
    btnChangeParent: 'Change',
    placeholderNewFolderName: 'Folder name',
    btnCreateFolder: 'Create',
    btnCancel: 'Cancel',
    toastFolderNameRequired: 'Please enter a folder name',
    toastFolderCreateError: 'Failed to create the folder',
    headingTagManagement: 'Delete Tags',
    tagManagementDesc: 'Delete tags you no longer need. Deleting a tag removes it from every card that has it.',
    tagManagementEmpty: 'No tags available to delete',
    confirmDeleteTag: 'Delete "{tag}"? This may change the terrain in Tag Showdown mode. This cannot be undone. Are you sure?',
    toastTagDeleted: 'Deleted "{tag}"',
    toastTagDeleteError: 'Failed to delete the tag',
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
    headingAdPrivacy: 'Ad Privacy Settings',
    adPrivacyDesc: 'You can change your ad consent choices at any time.',
    btnAdPrivacyOptions: 'Manage Consent',
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
    kassenAnniversaryLabel: '🎉 {count}-Battle Anniversary Bonus!',
    kassenCentennialLabel: '🎊 {count}-Battle Anniversary Bonus!',
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
    // 脱落したチームの陣地を継承した側（陣地拡大チーム）にフィーチャーした実況
    kassenTerritoryTemplates: [
      "Thanks to {name}'s efforts, {winner} expands their territory!",
      '{winner} is gaining momentum, led by {name}!',
      "With {name} leading the charge, {winner}'s influence grows even further!",
      "Before anyone noticed, {winner}'s territory had grown — {name} was at the center of it.",
      'With {name} shining, {winner} steadily expands their domain!'
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
      '{name} keeps the rhythm with an easy smile!',
      '{name} takes command of the arena with a graceful bow!',
      '{name} flows through a seamless motion!',
      "One glance from {name} shifts the mood!",
      '{name} steps forward with effortless grace!',
      '{name} shows off a quiet, commanding presence!',
      '{name} steals the lead with a cool expression!',
      "{name}'s fingertips conjure a dazzling move!",
      '{name} lights up the arena with a light-footed stride!',
      '{name} unleashes a polished flash of brilliance!',
      '{name} draws the momentum in with easy confidence!'
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
    // Plays when 9 exchanges pass without a winner, replacing what would be the 10th push
    duelFinalPhase: 'Final showdown! Who will come out on top!?',
    duelUltimateTemplates: [
      '🌟 {name} unleashes the ultimate move: Perfect Smile!',
      '🌟 {name} commands the arena with the ultimate move: Thunderous Applause!',
      "🌟 {name}'s ultimate move, Moment of Silence, changes everything!",
      '🌟 {name} releases the ultimate move: Rainbow Sigh!',
      "🌟 {name}'s ultimate move, Starlit Blessing, descends upon the arena!",
      '🌟 {name} captivates everyone with the ultimate move: Heartfelt Bow!',
      "🌟 {name}'s ultimate move, Miracle Word, seals the outcome!",
      '🌟 {name} settles it with the ultimate move: Handshake of Light!',
      '🌟 {name} unleashes the legendary ultimate move: Wink!',
      '🌟 {name} claims victory with the ultimate move: Eternal Standing Ovation!'
    ],

    loadingDefault: 'Loading...',
    loadingSigningIn: 'Signing in with Google...',
    loadingSyncing: 'Syncing with Google Drive...',
    loadingOpeningPicker: 'Preparing folder picker...',
    loadingImage: 'Loading image...',
    loadingDeleting: 'Deleting card...',
    loadingSavingNew: 'Saving to Google Drive...',
    loadingSavingEdit: 'Saving changes...',

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
  updateUpgradeSectionDisplay();

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
  // Crop Screen（撮影・選択した写真のトリミング）
  cropImageWrapper: document.getElementById('crop-image-wrapper'),
  cropImage: document.getElementById('crop-image'),
  cropRect: document.getElementById('crop-rect'),
  btnCropCancel: document.getElementById('btn-crop-cancel'),
  btnCropConfirm: document.getElementById('btn-crop-confirm'),
  // Settings Screen
  btnCloseSettings: document.getElementById('btn-close-settings'),
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  userAvatar: document.getElementById('user-avatar'),
  btnLogout: document.getElementById('btn-logout'),
  currentFolderName: document.getElementById('current-folder-name'),
  btnChangeFolder: document.getElementById('btn-change-folder'),
  folderChoiceOverlay: document.getElementById('folder-choice-overlay'),
  btnFolderChoiceClose: document.getElementById('btn-folder-choice-close'),
  folderChoiceButtons: document.getElementById('folder-choice-buttons'),
  btnFolderChoiceExisting: document.getElementById('btn-folder-choice-existing'),
  btnFolderChoiceNew: document.getElementById('btn-folder-choice-new'),
  folderChoiceNewForm: document.getElementById('folder-choice-new-form'),
  newFolderParentName: document.getElementById('new-folder-parent-name'),
  btnNewFolderParentChange: document.getElementById('btn-new-folder-parent-change'),
  inputNewFolderName: document.getElementById('input-new-folder-name'),
  btnFolderCreateConfirm: document.getElementById('btn-folder-create-confirm'),
  btnFolderCreateCancel: document.getElementById('btn-folder-create-cancel'),
  tagManagementList: document.getElementById('tag-management-list'),
  tagManagementEmpty: document.getElementById('tag-management-empty'),
  tagDeleteConfirm: document.getElementById('tag-delete-confirm'),
  tagDeleteConfirmText: document.getElementById('tag-delete-confirm-text'),
  btnTagDeleteYes: document.getElementById('btn-tag-delete-yes'),
  btnTagDeleteNo: document.getElementById('btn-tag-delete-no'),
  settingsAdPrivacySection: document.getElementById('settings-ad-privacy-section'),
  btnAdPrivacyOptions: document.getElementById('btn-ad-privacy-options'),
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
  // Derby Mode Screen（ダービーモード）
  btnDerby: document.getElementById('btn-derby'),
  btnCloseDerby: document.getElementById('btn-close-derby'),
  btnDerbyRanking: document.getElementById('btn-derby-ranking'),
  derbyRankingView: document.getElementById('derby-ranking-view'),
  derbyRankingList: document.getElementById('derby-ranking-list'),
  btnCloseDerbyRanking: document.getElementById('btn-close-derby-ranking'),
  derbyMatch: document.getElementById('derby-match'),
  derbyEmptyState: document.getElementById('derby-empty-state'),
  derbyTrackWrapper: document.getElementById('derby-track-wrapper'),
  derbyTrack: document.getElementById('derby-track'),
  derbyCommentary: document.getElementById('derby-commentary'),
  derbyCommentaryText: document.getElementById('derby-commentary-text'),
  derbyLineup: document.getElementById('derby-lineup'),
  btnStartDerby: document.getElementById('btn-start-derby'),
  btnDerbyReselect: document.getElementById('btn-derby-reselect'),
  derbyBonusBadge: document.getElementById('derby-bonus-badge'),
  derbyBattleCount: document.getElementById('derby-battle-count'),
  derbyScreenContent: document.querySelector('#screen-derby .screen-content'),
  // Upgrade / Paywall Screen（名刺登録上限解除の課金案内）
  settingsUpgradeSection: document.getElementById('settings-upgrade-section'),
  settingsUpgradeStatus: document.getElementById('settings-upgrade-status'),
  btnOpenUpgrade: document.getElementById('btn-open-upgrade'),
  btnCloseUpgrade: document.getElementById('btn-close-upgrade'),
  btnPurchaseUpgrade: document.getElementById('btn-purchase-upgrade'),
  upgradePriceLabel: document.getElementById('upgrade-price-label'),
  upgradeUnavailableNote: document.getElementById('upgrade-unavailable-note'),
  // Card Zoom Overlay（名刺タップでの拡大表示）
  cardZoomOverlay: document.getElementById('card-zoom-overlay'),
  cardZoomViewport: document.getElementById('card-zoom-viewport'),
  cardZoomImage: document.getElementById('card-zoom-image'),
  cardZoomSpinner: document.getElementById('card-zoom-spinner'),
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

  // ネイティブアプリ上ではGIS（Google Identity Services）の埋め込みスクリプト自体が
  // Googleにブロックされ必ず失敗するため、初期化を試みない（handleLoginでCustom Tabsに分岐する）
  if (!IS_NATIVE_APP) {
    initGoogleAuth();
  } else {
    // 広告を表示する画面を開く前に同意状況を確定させておきたいので、起動時に済ませておく
    // （設定画面の「広告のプライバシー設定」欄の表示要否もここで決まる）
    ensureAdMobInitialized();
  }

  // 実際の購入状況（Google Play Billing）をバックグラウンドで確認
  if (IAP_ENABLED) checkProEntitlement();

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

  // 対戦系モード（合戦・デュエル・ダービー）を開いている間だけバナー広告を表示する
  if (AD_ENABLED_SCREENS.has(screenId)) {
    showModeBannerAd();
  } else {
    hideModeBannerAd();
  }
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
// GIS（Google Identity Services）のスクリプトはindex.html側でasync deferで読み込まれるため、
// このアプリ側の初期化コードより後にgoogleオブジェクトが定義されるタイミングがあり得る。
// その場合にすぐエラー扱いにせず、スクリプトの読み込みを少し待ってから再試行する
// （最大20回×150ms=3秒。それでも読み込めなければ本当に失敗とみなす）
function initGoogleAuth(retryCount = 0) {
  if (!STATE.clientId) return;

  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    if (retryCount < 20) {
      setTimeout(() => initGoogleAuth(retryCount + 1), 150);
    } else {
      console.error('Google Identity Services script failed to load in time.');
      showToast(t('toastGoogleLibError'));
    }
    return;
  }

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

// Capacitorネイティブアプリ（Android実機アプリ）上では、Googleが埋め込みWebView内での
// Googleサインインをブロックするため、GIS（Google Identity Services）の埋め込みフローが使えない。
// そのためネイティブアプリ上でのみ、Custom Tabs（実機のChrome）を別途開いてサインインしてもらい、
// oauth-callback.html経由でアプリ独自のURLスキームに戻してトークンを受け取る方式にする。
// Web版・TWA版（実Chromeで開いている場合）は従来通りGISの埋め込みフローのままで問題ない
const IS_NATIVE_APP = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const NATIVE_OAUTH_CALLBACK_URL = 'https://hideyukikumura.github.io/cardvault/oauth-callback.html';
const NATIVE_FOLDER_PICKER_URL = 'https://hideyukikumura.github.io/cardvault/folder-picker.html';
const NATIVE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// Custom Tabsで開いた認証系フロー（ログイン／既存フォルダ選択）が、まだ結果を受け取れていないかを
// 共通で管理する。ユーザーがCustom Tabsを手動で閉じた（バックボタン等）場合はappUrlOpenが発火せず
// browserFinishedのみが呼ばれるため、その際にどちらのフローの後始末をすべきか判定するのに使う
let pendingNativeFlow = null; // 'login' | 'folderPicker' | null
let nativeFolderPickerResolve = null;

function handleNativeLogin() {
  pendingNativeFlow = 'login';
  const params = new URLSearchParams({
    client_id: STATE.clientId,
    redirect_uri: NATIVE_OAUTH_CALLBACK_URL,
    response_type: 'token',
    scope: NATIVE_OAUTH_SCOPE,
    prompt: 'consent',
    include_granted_scopes: 'true'
  });
  window.Capacitor.Plugins.Browser.open({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
}

// oauth-callback.htmlがカスタムURLスキーム（com.hideyukikumura.cardvalia://oauth-callback#...）で
// アプリに制御を戻してきた際の受け取り処理。GISの成功コールバックと同じ後続処理を行う
function handleNativeOAuthCallback(url) {
  pendingNativeFlow = null;
  window.Capacitor.Plugins.Browser.close().catch(() => {});

  const hashIndex = url.indexOf('#');
  const params = new URLSearchParams(hashIndex >= 0 ? url.slice(hashIndex + 1) : '');

  if (params.get('error')) {
    hideLoading();
    showToast(t('toastAuthError', { error: params.get('error') }));
    return;
  }

  const accessToken = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '0', 10);
  if (!accessToken) {
    hideLoading();
    showToast(t('toastGoogleLibError'));
    return;
  }

  STATE.accessToken = accessToken;
  STATE.tokenExpiry = Date.now() + expiresIn * 1000;
  localStorage.setItem('accessToken', STATE.accessToken);
  localStorage.setItem('tokenExpiry', STATE.tokenExpiry.toString());

  showToast(t('toastAuthSuccess'));
  fetchUserProfile();
  showScreen('screen-main');
  syncWithDrive();
}

// Google Picker自体もWebView内からのアクセスをブロックするため、folder-picker.html
// （Picker本体を読み込む中継ページ）をCustom Tabsで開き、選択結果をURLスキームで受け取る
function openNativeGoogleDrivePicker() {
  return new Promise((resolve) => {
    pendingNativeFlow = 'folderPicker';
    nativeFolderPickerResolve = resolve;
    const params = new URLSearchParams({ token: STATE.accessToken, key: GOOGLE_PICKER_API_KEY });
    window.Capacitor.Plugins.Browser.open({ url: `${NATIVE_FOLDER_PICKER_URL}?${params.toString()}` });
  });
}

// folder-picker.htmlがカスタムURLスキーム（...://folder-picker-callback?id=...&name=...）で
// 戻ってきた際の受け取り処理。idが無ければキャンセル扱い
function handleNativeFolderPickerCallback(url) {
  pendingNativeFlow = null;
  window.Capacitor.Plugins.Browser.close().catch(() => {});
  if (!nativeFolderPickerResolve) return;

  const queryIndex = url.indexOf('?');
  const params = new URLSearchParams(queryIndex >= 0 ? url.slice(queryIndex + 1) : '');
  const id = params.get('id');
  const name = params.get('name');

  const resolve = nativeFolderPickerResolve;
  nativeFolderPickerResolve = null;
  resolve(id ? { id, name: name || '' } : null);
}

if (IS_NATIVE_APP) {
  window.Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
    if (!data || !data.url) return;
    if (data.url.startsWith('com.hideyukikumura.cardvalia://oauth-callback')) {
      handleNativeOAuthCallback(data.url);
    } else if (data.url.startsWith('com.hideyukikumura.cardvalia://folder-picker-callback')) {
      handleNativeFolderPickerCallback(data.url);
    }
  });
  // ユーザーがCustom Tabsを手動で閉じた場合、appUrlOpenは発火しないため、
  // ここで各フローに応じた後始末（ローディング解除／Promiseのnull解決）を行う
  window.Capacitor.Plugins.Browser.addListener('browserFinished', () => {
    if (pendingNativeFlow === 'login') {
      hideLoading();
    } else if (pendingNativeFlow === 'folderPicker' && nativeFolderPickerResolve) {
      const resolve = nativeFolderPickerResolve;
      nativeFolderPickerResolve = null;
      resolve(null);
    }
    pendingNativeFlow = null;
  });
}

// -------------------------------------------------------------
// ADMOB BANNER ADS（ネイティブアプリのみ。対戦系モード画面でのみ表示）
// -------------------------------------------------------------
const ADMOB_BANNER_AD_UNIT_ID = 'ca-app-pub-8261719378187197/7260264649';

// 開発中の実機テストで、本番の広告ユニットIDのまま誤クリック等によるポリシー違反を起こさないよう、
// この端末をテストデバイスとして登録する（登録するとテスト用ラベル付きの広告が表示される）
// TODO: 本番リリース前にこの端末IDは削除すること（テスト端末登録は開発中のみ有効にする）
const ADMOB_TEST_DEVICE_IDS = ['E01FB3087CB81675AF4D3B3B65A794FF'];

// バナー広告を表示する画面（合戦・デュエル・ダービー、それぞれのランキング表示含む）
const AD_ENABLED_SCREENS = new Set(['screen-kassen', 'screen-duel', 'screen-derby']);

let admobInitialized = false;
let modeBannerVisible = false;
// 対象地域（EEA/UK等）のユーザーには、いつでも同意内容を見直せる入口を設定画面に出す必要がある
let adPrivacyOptionsRequired = false;

async function ensureAdMobInitialized() {
  if (admobInitialized) return;
  admobInitialized = true;
  try {
    await window.Capacitor.Plugins.AdMob.initialize({ testingDevices: ADMOB_TEST_DEVICE_IDS });

    // バナー広告の実際の高さに合わせて、対戦系画面の下部に余白を確保する
    // （広告に隠れて「合戦開始」ボタン等が見えなくなるのを防ぐため）。
    // 広告の自動更新が一時的に失敗した際も高さ0の通知が来るが、その間も広告自体は
    // 表示され続ける（＝余白を詰めてはいけない）ため、0はここでは無視し、
    // 実際に画面を離れる際（hideModeBannerAd）にのみ余白をリセットする
    window.Capacitor.Plugins.AdMob.addListener('bannerAdSizeChanged', (info) => {
      if (info.height > 0) {
        document.documentElement.style.setProperty('--ad-banner-height', `${info.height}px`);
      }
    });

    // GDPR等の同意確認（UMP）。対象地域のユーザーには、広告表示前に同意フォームを提示する。
    // debugGeography:1(EEA)はADMOB_TEST_DEVICE_IDSに登録した端末にしか作用しないため、
    // 実際のユーザーの地域判定には影響しない（このアプリの動作確認用）
    let consentInfo = await window.Capacitor.Plugins.AdMob.requestConsentInfo({
      debugGeography: 1,
      testDeviceIdentifiers: ADMOB_TEST_DEVICE_IDS
    });
    if (consentInfo.isConsentFormAvailable && consentInfo.status === 'REQUIRED') {
      consentInfo = await window.Capacitor.Plugins.AdMob.showConsentForm();
    }
    adPrivacyOptionsRequired = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED';
    updateAdPrivacySectionVisibility();
  } catch (error) {
    console.error('AdMob initialize error:', error);
  }
}

// 設定画面の「広告のプライバシー設定」欄を、同意状況に応じて表示・非表示する
function updateAdPrivacySectionVisibility() {
  elements.settingsAdPrivacySection.classList.toggle('hidden', !(IS_NATIVE_APP && adPrivacyOptionsRequired));
}

// @capacitor-community/admobの仕様上、showBanner()はバナー未作成時にしか実際の表示処理をしない
// （2回目以降はhideBanner()で隠した状態から復帰せず、非表示のまま残ってしまう）。
// そのため、一度作成済みかどうかをこちらで覚えておき、2回目以降はresumeBanner()を使う。
let bannerAdCreated = false;

async function showModeBannerAd() {
  if (!IS_NATIVE_APP || modeBannerVisible) return;
  modeBannerVisible = true;
  try {
    await ensureAdMobInitialized();
    if (bannerAdCreated) {
      await window.Capacitor.Plugins.AdMob.resumeBanner();
    } else {
      bannerAdCreated = true;
      await window.Capacitor.Plugins.AdMob.showBanner({
        adId: ADMOB_BANNER_AD_UNIT_ID,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0
      });
    }
  } catch (error) {
    console.error('AdMob showBanner error:', error);
  }
}

async function hideModeBannerAd() {
  if (!IS_NATIVE_APP || !modeBannerVisible) return;
  modeBannerVisible = false;
  document.documentElement.style.setProperty('--ad-banner-height', '0px');
  try {
    await window.Capacitor.Plugins.AdMob.hideBanner();
  } catch (error) {
    console.error('AdMob hideBanner error:', error);
  }
}

function handleLogin() {
  showLoading(t('loadingSigningIn'));

  if (IS_NATIVE_APP) {
    handleNativeLogin();
    return;
  }

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

// ユーザーが自身のGoogleドライブ内の既存フォルダを保存先として選ぶ（Picker経由で選んだフォルダには
// drive.fileスコープのままアクセス権が付与されるため、スコープを広げる必要はない）。
// キャンセル時はnullを返す。
// 注：Google Picker（埋め込みウィジェット）には新規フォルダ作成ボタンが無いため、
// 「新しいフォルダを作成」はopenFolderPicker()側でDrive APIを直接呼んで別途対応している
async function openGoogleDrivePicker() {
  // ネイティブアプリではGoogle PickerもWebView内での埋め込み利用がブロックされるため、
  // Custom Tabs経由の別実装（folder-picker.html）に分岐する
  if (IS_NATIVE_APP) {
    return openNativeGoogleDrivePicker();
  }

  // Pickerモジュールの読み込みには通信を伴うため、その間だけローディング表示を出す。
  // 表示したままpicker.setVisible(true)まで進むと、全画面オーバーレイがPickerダイアログの
  // クリックを塞いでしまうため、Picker表示直前に必ず隠す
  showLoading(t('loadingOpeningPicker'));
  try {
    await loadGooglePicker();
  } finally {
    hideLoading();
  }

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMode(google.picker.DocsViewMode.LIST)
      // 初期表示をマイドライブのルートにし、他アカウントから共有されたフォルダ（「リンクを知っている全員」等）を
      // 一覧から除外して、自分の所有物のみを選択候補にする
      .setParent('root')
      .setOwnedByMe(true);

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

// 指定した親フォルダ（省略時はマイドライブ直下）に、指定した名前で新しいフォルダを作成する
async function createDriveFolder(name, parentId = 'root') {
  const res = await driveFetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
  });
  if (!res.ok) throw new Error('Failed to create folder');
  return res.json();
}

// 保存先フォルダ選択の入り口。「既存のフォルダから選ぶ」（Google Picker）と
// 「新しいフォルダを作成」（Drive APIで直接作成）のどちらかをユーザーに選んでもらう。
// キャンセル時はnullを返す
function openFolderPicker() {
  return new Promise((resolve) => {
    // 「新しいフォルダを作成」の作成先。デフォルトはマイドライブ直下だが、
    // 「変更」からGoogle Pickerで任意のフォルダに切り替えられる
    let newFolderParent = { id: 'root', name: t('myDriveRootLabel') };

    elements.inputNewFolderName.value = '';
    elements.folderChoiceButtons.classList.remove('hidden');
    elements.folderChoiceNewForm.classList.add('hidden');
    elements.folderChoiceOverlay.classList.remove('hidden');
    lucide.createIcons();

    const cleanup = () => {
      elements.folderChoiceOverlay.classList.add('hidden');
      elements.btnFolderChoiceExisting.removeEventListener('click', onExisting);
      elements.btnFolderChoiceNew.removeEventListener('click', onShowNewForm);
      elements.btnNewFolderParentChange.removeEventListener('click', onChangeParent);
      elements.btnFolderCreateConfirm.removeEventListener('click', onCreateConfirm);
      elements.btnFolderCreateCancel.removeEventListener('click', onCreateCancel);
      elements.btnFolderChoiceClose.removeEventListener('click', onClose);
    };

    const onExisting = async () => {
      cleanup();
      resolve(await openGoogleDrivePicker());
    };

    const onShowNewForm = () => {
      newFolderParent = { id: 'root', name: t('myDriveRootLabel') };
      elements.newFolderParentName.textContent = newFolderParent.name;
      elements.folderChoiceButtons.classList.add('hidden');
      elements.folderChoiceNewForm.classList.remove('hidden');
      elements.inputNewFolderName.focus();
    };

    // 新規フォルダの作成先を、Google Picker経由でマイドライブ内の任意のフォルダに変更する
    const onChangeParent = async () => {
      // Google Picker自体はdocument.body直下に表示されるが、このオーバーレイを
      // 表示したままだと手前を覆ってPickerを操作できなくなるため、開いている間だけ隠す
      elements.folderChoiceOverlay.classList.add('hidden');
      const picked = await openGoogleDrivePicker();
      elements.folderChoiceOverlay.classList.remove('hidden');
      if (picked) {
        newFolderParent = picked;
        elements.newFolderParentName.textContent = picked.name;
      }
    };

    const onCreateCancel = () => {
      elements.folderChoiceNewForm.classList.add('hidden');
      elements.folderChoiceButtons.classList.remove('hidden');
    };

    const onCreateConfirm = async () => {
      const name = elements.inputNewFolderName.value.trim();
      if (!name) {
        showToast(t('toastFolderNameRequired'));
        return;
      }
      cleanup();
      showLoading(t('loadingSyncing'));
      try {
        const folder = await createDriveFolder(name, newFolderParent.id);
        resolve({ id: folder.id, name: folder.name });
      } catch (error) {
        console.error('Folder Create Error:', error);
        showToast(t('toastFolderCreateError'));
        resolve(null);
      } finally {
        hideLoading();
      }
    };

    const onClose = () => {
      cleanup();
      resolve(null);
    };

    elements.btnFolderChoiceExisting.addEventListener('click', onExisting);
    elements.btnFolderChoiceNew.addEventListener('click', onShowNewForm);
    elements.btnNewFolderParentChange.addEventListener('click', onChangeParent);
    elements.btnFolderCreateConfirm.addEventListener('click', onCreateConfirm);
    elements.btnFolderCreateCancel.addEventListener('click', onCreateCancel);
    elements.btnFolderChoiceClose.addEventListener('click', onClose);
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

// -------------------------------------------------------------
// TAG MANAGEMENT（設定画面：登録済みタグの削除）
// -------------------------------------------------------------
// 削除確認ダイアログで「はい」を押した際にどのタグを消すかを覚えておく
let pendingTagToDelete = null;

function renderTagManagementList() {
  const allTagsSet = new Set();
  STATE.cards.forEach(card => {
    if (card.tags) card.tags.forEach(tag => allTagsSet.add(tag));
  });
  const tags = [...allTagsSet].sort((a, b) => a.localeCompare(b, 'ja'));

  elements.tagManagementList.innerHTML = '';
  elements.tagManagementEmpty.classList.toggle('hidden', tags.length > 0);

  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-management-chip';
    chip.innerHTML = `
      <span>${escapeHTML(tag)}</span>
      <button type="button" class="btn-tag-delete" data-tag="${escapeHTML(tag)}" aria-label="${t('headingTagManagement')}">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    elements.tagManagementList.appendChild(chip);
  });

  lucide.createIcons();
}

function requestDeleteTag(tag) {
  pendingTagToDelete = tag;
  elements.tagDeleteConfirmText.textContent = t('confirmDeleteTag', { tag });
  elements.tagDeleteConfirm.classList.remove('hidden');
}

// 指定タグを、それを持つ全名刺データから取り除く。ランキング・ミッション達成状況等は一切変更しない
async function deleteTag(tag) {
  showLoading(t('loadingSyncing'));
  try {
    STATE.cards.forEach(card => {
      if (!card.tags || !card.tags.includes(tag)) return;
      card.tags = card.tags.filter(t2 => t2 !== tag);
      // タグ合戦モードの陣地割り当ても、削除したタグの分は不要になるため一緒に片付ける
      if (card.kassenPos && card.kassenPos.tag) {
        delete card.kassenPos.tag[tag];
      }
    });

    const saveSuccess = await saveMetadata();
    if (!saveSuccess) {
      throw new Error('Failed to update metadata.json');
    }

    renderTagManagementList();
    renderApp();
    showToast(t('toastTagDeleted', { tag }));
  } catch (error) {
    console.error('Tag Delete Error:', error);
    showToast(t('toastTagDeleteError'));
  } finally {
    hideLoading();
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
  const mediaPart = JSON.stringify({ cards: [], kassenBattleCount: { tag: 0, initial: 0 }, islandDetected: false, missionsAchieved: [], lastLaunchDate: null, launchStreak: 0, returnAfterGapDetected: false, usedAlphabetSort: false, usedNewestSortAfterAlphabet: false, duelBattleCount: 0, derbyBattleCount: 0, duelUltimateMoveTriggered: false }); // 空の名刺リスト

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
      STATE.derbyBattleCount = 0;
      STATE.duelUltimateMoveTriggered = false;
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
      STATE.derbyBattleCount = data.derbyBattleCount || 0;
      STATE.duelUltimateMoveTriggered = !!data.duelUltimateMoveTriggered;
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
      derbyBattleCount: STATE.derbyBattleCount,
      duelUltimateMoveTriggered: STATE.duelUltimateMoveTriggered,
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

// 並べ替えボタンをタップするたびに切り替わるモードの順番
const SORT_MODE_CYCLE = ['newest', 'alphabet', 'yearAsc', 'yearDesc'];
const SORT_MODE_TITLE_KEYS = {
  newest: 'titleSortNewest',
  alphabet: 'titleSortAlphabet',
  yearAsc: 'titleSortYearAsc',
  yearDesc: 'titleSortYearDesc'
};
const SORT_MODE_POPUP_KEYS = {
  newest: 'sortPopupNewestTitle',
  alphabet: 'sortPopupAlphabetTitle',
  yearAsc: 'sortPopupYearAscTitle',
  yearDesc: 'sortPopupYearDescTitle'
};

function nextSortMode(mode) {
  const idx = SORT_MODE_CYCLE.indexOf(mode);
  return SORT_MODE_CYCLE[(idx + 1) % SORT_MODE_CYCLE.length];
}

// 並べ替えボタンのツールチップ表示を現在のモードに合わせて更新
function updateSortButtonUI() {
  elements.btnSort.title = t(SORT_MODE_TITLE_KEYS[STATE.sortMode]);
}

// 並べ替えボタン押下時、現在の並べ替えモードを画面中央に一瞬表示する
let sortModePopupTimeout;
function showSortModePopup() {
  elements.sortModePopupTitle.textContent = t(SORT_MODE_POPUP_KEYS[STATE.sortMode]);

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
  switch (STATE.sortMode) {
    case 'alphabet':
      STATE.filteredCards.sort((a, b) =>
        (a.alphabet || '').localeCompare(b.alphabet || '', undefined, { sensitivity: 'base' })
      );
      break;
    case 'yearAsc':
      STATE.filteredCards.sort((a, b) =>
        getCardRegisteredMonth(a).localeCompare(getCardRegisteredMonth(b))
      );
      break;
    case 'yearDesc':
      STATE.filteredCards.sort((a, b) =>
        getCardRegisteredMonth(b).localeCompare(getCardRegisteredMonth(a))
      );
      break;
    default: // 'newest'
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

// 各モードの現在のランキング1位カードIDをまとめて算出する。
// renderCards()内でカードごとに毎回ランキング計算をやり直さないよう、1回だけ実行してMapとして使い回す
function getMainScreenRankOneCardIds() {
  const ids = {};
  const tagTop = getKassenRanking('tag')[0];
  if (tagTop) ids.kassenTag = tagTop.id;
  const initialTop = getKassenRanking('initial')[0];
  if (initialTop) ids.kassenInitial = initialTop.id;
  const duelTop = getDuelRanking()[0];
  if (duelTop) ids.duel = duelTop.id;
  const derbyTop = getDerbyRanking()[0];
  if (derbyTop) ids.derby = derbyTop.id;
  return ids;
}

// 該当カードが各モードの現在のランキング1位であれば、そのバッジ（王冠アイコン＋ラベル）のHTMLを返す
function buildCardRankBadgesHTML(card, rankOneIds) {
  const badges = [];
  if (rankOneIds.derby === card.id) badges.push({ jump: 'derby', label: t('badgeRankOneDerby') });
  if (rankOneIds.kassenTag === card.id) badges.push({ jump: 'kassenTag', label: t('badgeRankOneKassenTag') });
  if (rankOneIds.kassenInitial === card.id) badges.push({ jump: 'kassenInitial', label: t('badgeRankOneKassenInitial') });
  if (rankOneIds.duel === card.id) badges.push({ jump: 'duel', label: t('badgeRankOneDuel') });

  if (badges.length === 0) return '';

  return `
    <div class="card-rank-badges">
      ${badges.map(b => `<button type="button" class="card-rank-badge" data-jump="${b.jump}"><i data-lucide="crown"></i>${escapeHTML(b.label)}</button>`).join('')}
    </div>
  `;
}

// メイン画面のランキング1位バッジをタップした際、該当モードのランキング画面へ直接ジャンプする
function goToKassenRankingFromMain(mode) {
  STATE.kassenMode = mode;
  document.querySelectorAll('.kassen-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  showScreen('screen-kassen');
  showKassenView('ranking');
}

function goToDuelRankingFromMain() {
  showScreen('screen-duel');
  showDuelView('ranking');
}

function goToDerbyRankingFromMain() {
  showScreen('screen-derby');
  updateDerbyBattleCountDisplay();
  showDerbyView('ranking');
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
      emptyAddBtn.addEventListener('click', openAddCardScreen);
    }
    lucide.createIcons();
    return;
  }

  elements.cardIndicator.classList.remove('hidden');
  updateIndicator();

  const rankOneIds = getMainScreenRankOneCardIds();

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
        ${buildCardRankBadgesHTML(card, rankOneIds)}
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
          ${card.tags ? card.tags.map(tag => `<button type="button" class="card-tag" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join('') : ''}
        </div>
        ${card.memo ? `<p class="card-memo">${escapeHTML(card.memo)}</p>` : ''}
      </div>
    `;

    container.appendChild(cardEl);

    // 名刺画像タップで拡大表示を開く
    cardEl.querySelector('.card-image-wrapper').addEventListener('click', () => {
      openCardZoom(card);
    });
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

// -------------------------------------------------------------
// CARD ZOOM（名刺タップでの拡大表示。ピンチで拡大縮小、タップで閉じる）
// -------------------------------------------------------------
const CARD_ZOOM_MIN_SCALE = 1;
const CARD_ZOOM_MAX_SCALE = 4;
const CARD_ZOOM_TAP_THRESHOLD = 10; // この距離（px）以上動いたらタップではなくドラッグ／ピンチとみなす

const cardZoomState = {
  pointers: new Map(),   // pointerId -> {x, y}
  scale: 1,
  translateX: 0,
  translateY: 0,
  panStart: null,        // パン開始時の {x, y, translateX, translateY}
  pinchStartDistance: 0,
  pinchStartScale: 1,
  moved: false           // タップと判定してよいか（true=ドラッグ／ピンチとみなし、タップでは閉じない）
};

function getCardZoomPointerDistance() {
  const pts = Array.from(cardZoomState.pointers.values());
  const dx = pts[0].x - pts[1].x;
  const dy = pts[0].y - pts[1].y;
  return Math.sqrt(dx * dx + dy * dy);
}

function applyCardZoomTransform() {
  elements.cardZoomImage.style.transform =
    `translate(${cardZoomState.translateX}px, ${cardZoomState.translateY}px) scale(${cardZoomState.scale})`;
}

function resetCardZoomState() {
  cardZoomState.pointers.clear();
  cardZoomState.scale = 1;
  cardZoomState.translateX = 0;
  cardZoomState.translateY = 0;
  cardZoomState.panStart = null;
  cardZoomState.pinchStartDistance = 0;
  cardZoomState.pinchStartScale = 1;
  cardZoomState.moved = false;
  applyCardZoomTransform();
}

// 名刺画像タップで拡大表示を開く
async function openCardZoom(card) {
  if (!card.imageId) return;

  resetCardZoomState();
  elements.cardZoomOverlay.classList.remove('hidden');

  // 既にキャッシュ済みならすぐ表示、未取得ならスピナーを見せつつ取得する
  const cachedUrl = STATE.imageCache[card.imageId];
  if (cachedUrl) {
    elements.cardZoomImage.src = cachedUrl;
    elements.cardZoomImage.classList.remove('hidden');
    elements.cardZoomSpinner.classList.add('hidden');
  } else {
    elements.cardZoomImage.classList.add('hidden');
    elements.cardZoomSpinner.classList.remove('hidden');
    const imageUrl = await fetchCardImage(card.imageId);
    if (!elements.cardZoomOverlay.classList.contains('hidden') && imageUrl) {
      elements.cardZoomImage.src = imageUrl;
      elements.cardZoomImage.classList.remove('hidden');
      elements.cardZoomSpinner.classList.add('hidden');
    }
  }
}

function closeCardZoom() {
  elements.cardZoomOverlay.classList.add('hidden');
  elements.cardZoomImage.src = '';
  resetCardZoomState();
}

elements.cardZoomViewport.addEventListener('pointerdown', (e) => {
  cardZoomState.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (cardZoomState.pointers.size === 1) {
    cardZoomState.panStart = {
      x: e.clientX,
      y: e.clientY,
      translateX: cardZoomState.translateX,
      translateY: cardZoomState.translateY
    };
  } else if (cardZoomState.pointers.size === 2) {
    cardZoomState.pinchStartDistance = getCardZoomPointerDistance();
    cardZoomState.pinchStartScale = cardZoomState.scale;
  }

  // 一部の環境（合成イベント等）ではsetPointerCaptureが例外を投げることがあるが、
  // 上記の状態は既に確定済みのため、ここで失敗しても実害はない
  try {
    elements.cardZoomViewport.setPointerCapture(e.pointerId);
  } catch (err) {
    // no-op
  }
});

elements.cardZoomViewport.addEventListener('pointermove', (e) => {
  if (!cardZoomState.pointers.has(e.pointerId)) return;
  cardZoomState.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (cardZoomState.pointers.size === 2) {
    // ピンチで拡大縮小
    const distance = getCardZoomPointerDistance();
    if (cardZoomState.pinchStartDistance > 0) {
      const rawScale = cardZoomState.pinchStartScale * (distance / cardZoomState.pinchStartDistance);
      cardZoomState.scale = Math.max(CARD_ZOOM_MIN_SCALE, Math.min(CARD_ZOOM_MAX_SCALE, rawScale));
      applyCardZoomTransform();
    }
    cardZoomState.moved = true;
  } else if (cardZoomState.pointers.size === 1 && cardZoomState.panStart) {
    const dx = e.clientX - cardZoomState.panStart.x;
    const dy = e.clientY - cardZoomState.panStart.y;
    if (Math.abs(dx) > CARD_ZOOM_TAP_THRESHOLD || Math.abs(dy) > CARD_ZOOM_TAP_THRESHOLD) {
      cardZoomState.moved = true;
    }
    // 拡大中のみドラッグでパン（等倍時はパンせず、タップ判定のみ行う）
    if (cardZoomState.scale > CARD_ZOOM_MIN_SCALE) {
      cardZoomState.translateX = cardZoomState.panStart.translateX + dx;
      cardZoomState.translateY = cardZoomState.panStart.translateY + dy;
      applyCardZoomTransform();
    }
  }
});

function handleCardZoomPointerEnd(e) {
  cardZoomState.pointers.delete(e.pointerId);

  if (cardZoomState.pointers.size === 0) {
    // 拡大縮小・ドラッグを伴わない単純なタップの場合のみ、メイン画面へ戻る
    if (!cardZoomState.moved) {
      closeCardZoom();
    } else {
      cardZoomState.moved = false;
      cardZoomState.panStart = null;
    }
  }
}

elements.cardZoomViewport.addEventListener('pointerup', handleCardZoomPointerEnd);
elements.cardZoomViewport.addEventListener('pointercancel', handleCardZoomPointerEnd);

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
// IN-APP PURCHASE（名刺登録上限解除。Google Play BillingをDigital Goods API経由で利用）
// -------------------------------------------------------------
let digitalGoodsService = null;

// この環境（Playストア経由でインストールされたTWA）でGoogle Play Billingが使えるかどうかを確認し、
// 使える場合はDigitalGoodsServiceを初期化する。通常のブラウザ等、非対応の環境ではnullを返す
async function initDigitalGoodsService() {
  if (digitalGoodsService) return digitalGoodsService;
  if (!('getDigitalGoodsService' in window)) return null;
  try {
    digitalGoodsService = await window.getDigitalGoodsService('https://play.google.com/billing');
    return digitalGoodsService;
  } catch (err) {
    console.warn('Digital Goods API is not available in this environment:', err);
    return null;
  }
}

// 実際の購入状況（Google Play Billing）を確認し、STATE.isProを確定させる。アプリ起動時に一度呼び出す。
// 取得に失敗した場合は、前回この端末で確認できていたキャッシュ値（localStorage）をそのまま維持する
async function checkProEntitlement() {
  const service = await initDigitalGoodsService();
  if (!service) return;

  try {
    const purchases = await service.listPurchases();
    const owned = purchases.some(p => p.itemId === IAP_UNLOCK_PRODUCT_ID);
    STATE.isPro = owned;
    localStorage.setItem('isPro', owned ? '1' : '0');
  } catch (err) {
    console.error('Failed to check purchase status:', err);
  }
}

// 設定画面の「アップグレード」欄を、現在の購入状態（STATE.isPro）に応じて更新する。
// IAP_ENABLEDがfalseの間（クローズドテスト中など）は欄ごと非表示にする
function updateUpgradeSectionDisplay() {
  elements.settingsUpgradeSection.classList.toggle('hidden', !IAP_ENABLED);
  if (!IAP_ENABLED) return;
  elements.settingsUpgradeStatus.textContent = STATE.isPro ? t('settingsUpgradeProDesc') : t('settingsUpgradeFreeDesc');
  elements.btnOpenUpgrade.classList.toggle('hidden', STATE.isPro);
}

// アップグレード画面で「閉じる」を押した際、開いた場所（メイン画面／設定画面）へ正しく戻すための記録
let upgradeScreenReturnTo = 'screen-main';

function openUpgradeScreen(returnTo) {
  upgradeScreenReturnTo = returnTo;
  showScreen('screen-upgrade');
  loadUpgradeScreenDetails();
}

// 新規登録画面を開く。無料版の上限（CARD_FREE_LIMIT）に達している場合はアップグレード画面へ誘導する
function openAddCardScreen() {
  if (IAP_ENABLED && !STATE.isPro && STATE.cards.length >= CARD_FREE_LIMIT) {
    openUpgradeScreen('screen-main');
    return;
  }
  resetAddForm();
  showScreen('screen-add');
}

// アップグレード画面を開くたびに、可能であればPlay Consoleに登録された実際の価格を反映する
async function loadUpgradeScreenDetails() {
  elements.upgradePriceLabel.textContent = t('btnUpgradePurchase');
  elements.upgradeUnavailableNote.classList.add('hidden');

  const service = await initDigitalGoodsService();
  if (!service) {
    elements.upgradeUnavailableNote.classList.remove('hidden');
    return;
  }

  try {
    const details = await service.getDetails([IAP_UNLOCK_PRODUCT_ID]);
    const item = details && details[0];
    if (item && item.price) {
      elements.upgradePriceLabel.textContent = `${t('btnUpgradePurchase')} (${item.price.value} ${item.price.currency})`;
    }
  } catch (err) {
    console.error('Failed to fetch product details:', err);
  }
}

// アップグレード（名刺登録上限解除）の購入フローを開始する
async function purchaseUpgrade() {
  if (STATE.isPro) return;

  const service = await initDigitalGoodsService();
  if (!service || !('PaymentRequest' in window)) {
    elements.upgradeUnavailableNote.classList.remove('hidden');
    return;
  }

  try {
    const details = await service.getDetails([IAP_UNLOCK_PRODUCT_ID]);
    const item = details && details[0];
    if (!item) {
      showToast(t('toastUpgradeError'));
      return;
    }

    const request = new PaymentRequest(
      [{ supportedMethods: 'https://play.google.com/billing', data: { sku: IAP_UNLOCK_PRODUCT_ID } }],
      { total: { label: item.title, amount: { currency: item.price.currency, value: item.price.value } } }
    );

    const paymentResponse = await request.show();
    await paymentResponse.complete('success');
    await service.acknowledge(paymentResponse.details.token, 'onetime');

    STATE.isPro = true;
    localStorage.setItem('isPro', '1');
    showToast(t('toastUpgradeSuccess'));
    showScreen('screen-main');
    renderApp();
  } catch (err) {
    if (err.name === 'AbortError') return; // ユーザーによるキャンセル
    console.error('Purchase failed:', err);
    showToast(t('toastUpgradeError'));
  }
}

// -------------------------------------------------------------
// NEW CARD REGISTRATION (新規登録)
// -------------------------------------------------------------
function registerEventListeners() {
  // サインイン画面
  elements.btnLogin.addEventListener('click', handleLogin);

  // メイン画面ヘッダー
  elements.btnSync.addEventListener('click', syncWithDrive);
  elements.btnSettings.addEventListener('click', () => {
    updateFolderNameDisplay();
    updateUpgradeSectionDisplay();
    renderTagManagementList();
    updateAdPrivacySectionVisibility();
    showScreen('screen-settings');
  });

  // 設定画面：広告の同意設定（プライバシーオプション）を開く
  elements.btnAdPrivacyOptions.addEventListener('click', () => {
    window.Capacitor.Plugins.AdMob.showPrivacyOptionsForm()
      .then(() => window.Capacitor.Plugins.AdMob.requestConsentInfo({
        debugGeography: 1,
        testDeviceIdentifiers: ADMOB_TEST_DEVICE_IDS
      }))
      .then(consentInfo => {
        adPrivacyOptionsRequired = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED';
        updateAdPrivacySectionVisibility();
      })
      .catch(error => console.error('AdMob showPrivacyOptionsForm error:', error));
  });
  elements.btnAddCard.addEventListener('click', openAddCardScreen);

  // 設定画面：アップグレード画面を開く
  elements.btnOpenUpgrade.addEventListener('click', () => {
    openUpgradeScreen('screen-settings');
  });

  // アップグレード画面：閉じる（開いた場所へ戻る）・購入
  elements.btnCloseUpgrade.addEventListener('click', () => {
    showScreen(upgradeScreenReturnTo);
  });
  elements.btnPurchaseUpgrade.addEventListener('click', purchaseUpgrade);

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

  // 並べ替え（登録順 → アルファベット順 → 年代昇順 → 年代降順 → …とタップごとに巡回）
  elements.btnSort.addEventListener('click', () => {
    STATE.sortMode = nextSortMode(STATE.sortMode);
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

  // 名刺カード上のタグタップ → そのタグでのフィルターモードへジャンプ。
  // ランキング1位バッジタップ → 該当モードのランキング画面へジャンプ
  elements.cardDeck.addEventListener('click', (e) => {
    const tagBtn = e.target.closest('.card-tag');
    if (tagBtn) {
      e.stopPropagation();
      STATE.selectedTag = tagBtn.dataset.tag;
      renderApp();
      return;
    }

    const badgeBtn = e.target.closest('.card-rank-badge');
    if (badgeBtn) {
      e.stopPropagation();
      const jump = badgeBtn.dataset.jump;
      if (jump === 'derby') goToDerbyRankingFromMain();
      else if (jump === 'duel') goToDuelRankingFromMain();
      else if (jump === 'kassenTag') goToKassenRankingFromMain('tag');
      else if (jump === 'kassenInitial') goToKassenRankingFromMain('initial');
    }
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

  // トリミング画面：キャンセル・確定
  elements.btnCropCancel.addEventListener('click', () => {
    showScreen('screen-add');
  });
  elements.btnCropConfirm.addEventListener('click', confirmCrop);

  // トリミング画面：クロップ範囲のドラッグ操作（四隅のハンドル or 範囲内部の移動）
  elements.cropRect.addEventListener('pointerdown', (e) => {
    const handleEl = e.target.closest('.crop-handle');
    const handle = handleEl ? handleEl.dataset.handle : 'move';
    e.target.setPointerCapture(e.pointerId);
    startCropDrag(handle, e);
  });
  elements.cropRect.addEventListener('pointermove', updateCropDrag);
  elements.cropRect.addEventListener('pointerup', endCropDrag);
  elements.cropRect.addEventListener('pointercancel', endCropDrag);

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
    try {
      const folder = await openFolderPicker();
      if (!folder) return;

      saveSelectedFolder(folder);
      // フォルダが変わったので、以前のフォルダのmetadata.json参照は破棄して読み直す
      STATE.metadataFileId = '';
      localStorage.removeItem('metadataFileId');
      await syncWithDrive();
    } catch (error) {
      console.error('Folder Change Error:', error);
      hideLoading();
      showToast(t('toastSyncError'));
    }
  });

  // 設定画面：タグの削除（確認ダイアログ）
  elements.tagManagementList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-tag-delete');
    if (!btn) return;
    requestDeleteTag(btn.dataset.tag);
  });
  elements.btnTagDeleteNo.addEventListener('click', () => {
    pendingTagToDelete = null;
    elements.tagDeleteConfirm.classList.add('hidden');
  });
  elements.btnTagDeleteYes.addEventListener('click', () => {
    elements.tagDeleteConfirm.classList.add('hidden');
    if (pendingTagToDelete) {
      deleteTag(pendingTagToDelete);
      pendingTagToDelete = null;
    }
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
    renderApp();
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
    renderApp();
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

  // ダービーモード：開く・閉じる・出走者再抽選
  elements.btnDerby.addEventListener('click', openDerbyMode);
  elements.btnCloseDerby.addEventListener('click', () => {
    showScreen('screen-main');
    renderApp();
  });

  elements.btnStartDerby.addEventListener('click', startDerbyRace);
  elements.btnDerbyReselect.addEventListener('click', drawDerbyLineup);

  // ダービーモード：ランキング表示の切り替え（トグル）
  elements.btnDerbyRanking.addEventListener('click', () => {
    showDerbyView(STATE.derbyView === 'ranking' ? 'match' : 'ranking');
  });
  elements.btnCloseDerbyRanking.addEventListener('click', () => {
    showDerbyView('match');
  });
  elements.derbyRankingList.addEventListener('click', (e) => {
    const item = e.target.closest('.kassen-ranking-item');
    if (!item) return;
    goToCardFromKassen(item.dataset.id);
  });
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

  if (pendingPhotoObjectUrl) {
    URL.revokeObjectURL(pendingPhotoObjectUrl);
    pendingPhotoObjectUrl = null;
  }
  pendingPhotoBlob = null;
  elements.inputFile.value = '';
}

// 撮影・選択した写真を直接プレビューに反映せず、まずトリミング画面を経由させる
function handleFileSelect(e) {
  const file = e.target.files[0];
  e.target.value = ''; // 同じファイルを連続選択してもchangeイベントが発火するようにする
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    openCropScreen(event.target.result);
  };
  reader.readAsDataURL(file);
}

// -------------------------------------------------------------
// PHOTO CROP SCREEN（撮影・選択した写真の自由なトリミング）
// -------------------------------------------------------------
// クロップ確定後の画像データ（Google Driveへのアップロードに使用）と、プレビュー表示用のobject URL
let pendingPhotoBlob = null;
let pendingPhotoObjectUrl = null;

const CROP_MIN_SIZE = 40; // クロップ範囲の最小サイズ（表示px基準）
const CROP_MAX_OUTPUT_DIM = 1600; // 出力画像の長辺の上限px

let cropDrag = null; // ドラッグ中の状態（handle種別 or 'move'、開始座標・矩形など）

function openCropScreen(imageDataUrl) {
  elements.cropImage.onload = () => {
    const w = elements.cropImage.clientWidth;
    const h = elements.cropImage.clientHeight;
    // 初期のクロップ範囲は画像全体に対して90%、中央寄せ
    const rect = {
      left: w * 0.05,
      top: h * 0.05,
      width: w * 0.9,
      height: h * 0.9
    };
    applyCropRect(rect);
  };
  elements.cropImage.src = imageDataUrl;
  showScreen('screen-crop');
}

function applyCropRect(rect) {
  elements.cropRect.style.left = `${rect.left}px`;
  elements.cropRect.style.top = `${rect.top}px`;
  elements.cropRect.style.width = `${rect.width}px`;
  elements.cropRect.style.height = `${rect.height}px`;
}

function getCropRect() {
  return {
    left: parseFloat(elements.cropRect.style.left) || 0,
    top: parseFloat(elements.cropRect.style.top) || 0,
    width: parseFloat(elements.cropRect.style.width) || 0,
    height: parseFloat(elements.cropRect.style.height) || 0
  };
}

function startCropDrag(handle, pointerEvent) {
  const wrapperW = elements.cropImage.clientWidth;
  const wrapperH = elements.cropImage.clientHeight;
  cropDrag = {
    handle,
    startX: pointerEvent.clientX,
    startY: pointerEvent.clientY,
    startRect: getCropRect(),
    wrapperW,
    wrapperH
  };
}

function updateCropDrag(pointerEvent) {
  if (!cropDrag) return;
  const dx = pointerEvent.clientX - cropDrag.startX;
  const dy = pointerEvent.clientY - cropDrag.startY;
  const { startRect, wrapperW, wrapperH, handle } = cropDrag;
  let { left, top, width, height } = startRect;

  if (handle === 'move') {
    left = clamp(startRect.left + dx, 0, wrapperW - startRect.width);
    top = clamp(startRect.top + dy, 0, wrapperH - startRect.height);
  } else {
    if (handle.includes('w')) {
      left = clamp(startRect.left + dx, 0, startRect.left + startRect.width - CROP_MIN_SIZE);
      width = startRect.left + startRect.width - left;
    }
    if (handle.includes('e')) {
      width = clamp(startRect.width + dx, CROP_MIN_SIZE, wrapperW - startRect.left);
    }
    if (handle.includes('n')) {
      top = clamp(startRect.top + dy, 0, startRect.top + startRect.height - CROP_MIN_SIZE);
      height = startRect.top + startRect.height - top;
    }
    if (handle.includes('s')) {
      height = clamp(startRect.height + dy, CROP_MIN_SIZE, wrapperH - startRect.top);
    }
  }

  applyCropRect({ left, top, width, height });
}

function endCropDrag() {
  cropDrag = null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// クロップ範囲を確定し、実画像の解像度で切り抜いたJPEG画像をプレビューに反映する
function confirmCrop() {
  const rect = getCropRect();
  const renderedW = elements.cropImage.clientWidth;
  const renderedH = elements.cropImage.clientHeight;
  const scaleX = elements.cropImage.naturalWidth / renderedW;
  const scaleY = elements.cropImage.naturalHeight / renderedH;

  const sx = rect.left * scaleX;
  const sy = rect.top * scaleY;
  const sw = rect.width * scaleX;
  const sh = rect.height * scaleY;

  const outputScale = Math.min(1, CROP_MAX_OUTPUT_DIM / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * outputScale));
  const outH = Math.max(1, Math.round(sh * outputScale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(elements.cropImage, sx, sy, sw, sh, 0, 0, outW, outH);

  canvas.toBlob((blob) => {
    if (!blob) return;

    if (pendingPhotoObjectUrl) {
      URL.revokeObjectURL(pendingPhotoObjectUrl);
    }
    pendingPhotoBlob = blob;
    pendingPhotoObjectUrl = URL.createObjectURL(blob);

    elements.photoPreview.src = pendingPhotoObjectUrl;
    elements.photoPreview.classList.remove('hidden');
    elements.photoPlaceholder.classList.add('hidden');

    showScreen('screen-add');
  }, 'image/jpeg', 0.9);
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
  const file = pendingPhotoBlob;

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
      if (!file) {
        throw new Error('No valid image file');
      }

      const cardId = 'card_' + Date.now();
      const driveImageId = await uploadImageToDrive(file, `${cardId}.jpg`);

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

// 同じ日（登録日時=createdAt基準）に登録した名刺の、これまでの最大枚数
function getMaxDailyRegistrationCount() {
  const countsByDate = {};
  STATE.cards.forEach(card => {
    if (!card.createdAt) return;
    const date = card.createdAt.slice(0, 10); // 'YYYY-MM-DD'
    countsByDate[date] = (countsByDate[date] || 0) + 1;
  });
  return Object.values(countsByDate).reduce((max, count) => Math.max(max, count), 0);
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
    // 同じ日に登録した名刺の最大枚数
    key: 'dailyRegistration',
    thresholds: [3, 5, 10],
    getCount: () => getMaxDailyRegistrationCount(),
    getThresholdLabel: threshold => t('missionDailyRegistration', { count: threshold }),
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
    // 押し合いが9回続いて決着がつかず、超奥義が発動したことが一度でもあるか
    key: 'duelUltimateMove',
    thresholds: [1],
    getCount: () => (STATE.duelUltimateMoveTriggered ? 1 : 0),
    getThresholdLabel: () => t('missionDuelUltimateMove'),
    lockedStatusKey: 'missionLockedDuel',
  },
  {
    key: 'derbyBattles',
    thresholds: [1, 5, 10, 25, 50],
    getCount: () => STATE.derbyBattleCount || 0,
    getThresholdLabel: threshold => t('missionThresholdDerbyBattles', { count: threshold }),
    lockedStatusKey: 'missionLockedDerby',
  },
  {
    // ダービーモードで、最もポイントを稼いだ名刺のポイント数
    key: 'derbyMaxPoints',
    thresholds: [10, 20],
    getCount: () => STATE.cards.reduce((max, card) => Math.max(max, getCardDerbyPoints(card)), 0),
    getThresholdLabel: threshold => t('missionMaxPointsDerby', { count: threshold }),
    lockedStatusKey: 'missionLockedDerby',
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
// mode省略時は現在合戦モード画面で選択中のモードを使う（タグ/イニシャルを個別に指定して呼ぶことも可能）
function getKassenRanking(mode = STATE.kassenMode) {
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

  // 前回の陣取り結果（ヘックスの所属・塗り色）とハイライトを、正しいチーム別の色分けに戻す。
  // 前回の合戦終了後は全ヘックスが勝利チームの色に塗り終わった状態のままなので、
  // 単にwinner/loserのCSSクラスを外すだけでは不十分で、地図自体を作り直す必要がある
  renderKassenMap();
  elements.kassenResult.innerHTML = '';
  elements.kassenResult.classList.add('hidden');

  const teamMap = buildKassenTeams(STATE.kassenMode);
  const teamKeys = [...teamMap.keys()];
  // ヘックスの塗り色はrenderKassenMap()と同じ「五十音順」の並びを基準に決めているため、
  // 陣取りで色を塗り替える際もこちらを使う（脱落順のシャッフル配列とは別物）
  const sortedTeamKeys = [...teamMap.keys()].sort((a, b) => a.localeCompare(b, 'ja'));

  // シャッフルして脱落順を決定する（最後に残った1チームが勝者）
  for (let i = teamKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [teamKeys[i], teamKeys[j]] = [teamKeys[j], teamKeys[i]];
  }
  const winningTeam = teamKeys[teamKeys.length - 1];
  const eliminationOrder = teamKeys.slice(0, teamKeys.length - 1);

  // まだ残っている（脱落していない）チーム。陣取りゲームのように、脱落したチームの領地（ヘックス）は
  // この中からランダムに選んだ1チームの色に塗り替わる（グレーアウトはしない）。
  // 凡例（マップ下のタグ表示）は現状通り、脱落と同時にグレーにする
  const aliveTeams = new Set(teamKeys);

  // fallenTeamの領地の継承先（まだ残っているチームからランダムに1つ）を決め、
  // その色・所属にヘックスを塗り替える。継承先チームは実況の選択にも使うため呼び出し元に返す
  function resolveKassenTerritoryTakeover(fallenTeam) {
    aliveTeams.delete(fallenTeam);
    const remainingTeams = [...aliveTeams];
    const conqueror = remainingTeams[Math.floor(Math.random() * remainingTeams.length)];
    const conquerorColor = getKassenTeamColor(sortedTeamKeys, conqueror);

    // fallenTeamの領地（既に他チームから継承済みの分も含む）をすべてconquerorの色・所属に塗り替える
    document.querySelectorAll('.kassen-hex').forEach(hex => {
      if (hex.dataset.team === fallenTeam) {
        hex.dataset.team = conqueror;
        hex.setAttribute('fill', conquerorColor);
      }
    });

    const loserLegendItem = elements.kassenLegend.querySelector(`.kassen-legend-item[data-team="${CSS.escape(fallenTeam)}"]`);
    if (loserLegendItem) loserLegendItem.classList.add('kassen-legend-item-loser');

    return conqueror;
  }

  kassenSkipRequested = false;
  setKassenControlsDisabled(true);
  elements.btnStartKassen.classList.add('hidden');
  elements.kassenCommentaryText.textContent = t('kassenOpening');
  elements.kassenCommentary.classList.remove('hidden');

  await kassenInterruptibleDelay(900);

  for (const team of eliminationOrder) {
    const conqueror = resolveKassenTerritoryTakeover(team);

    if (!kassenSkipRequested) {
      // 半々の確率で「脱落」実況と「陣地拡大」実況（継承したチームをフィーチャー）を出し分ける
      if (Math.random() < 0.5) {
        const members = teamMap.get(team);
        const featured = members[Math.floor(Math.random() * members.length)];
        const templates = t('narrationTemplates');
        const template = templates[Math.floor(Math.random() * templates.length)];
        const teamLabel = getKassenTeamDisplayLabel(team);
        elements.kassenCommentaryText.textContent = template.replace(/\{team\}/g, teamLabel).replace(/\{name\}/g, featured.name);
      } else {
        const conquerorMembers = teamMap.get(conqueror);
        const featured = conquerorMembers[Math.floor(Math.random() * conquerorMembers.length)];
        const templates = t('kassenTerritoryTemplates');
        const template = templates[Math.floor(Math.random() * templates.length)];
        const conquerorLabel = getKassenTeamDisplayLabel(conqueror);
        elements.kassenCommentaryText.textContent = template.replace(/\{winner\}/g, conquerorLabel).replace(/\{name\}/g, featured.name);
      }
    }

    if (kassenSkipRequested) continue; // スキップ時は演出なしで即座に残りを解決する
    await kassenInterruptibleDelay(KASSEN_NARRATION_STEP_MS);
  }

  // 全チームの脱落処理を終えると、上のカスケードにより全ヘックスが必然的にwinningTeamへ帰属する
  document.querySelectorAll('.kassen-hex').forEach(hex => {
    hex.classList.add('kassen-hex-winner');
    hex.classList.remove('kassen-hex-loser');
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

  await showKassenResult(winningTeam, mvp, mvpPoints, isAnniversaryBattle, isCentennialBattle, battleNumber);
}

async function showKassenResult(team, mvp, points, isAnniversaryBattle, isCentennialBattle, battleNumber) {
  let imageUrl = '';
  if (mvp.imageId) {
    imageUrl = await fetchCardImage(mvp.imageId);
  }

  elements.kassenResult.innerHTML = `
    <div class="kassen-result-card glass-card">
      <div class="kassen-result-badge">${t('kassenResultBadge', { team: escapeHTML(getKassenTeamDisplayLabel(team)) })}</div>
      ${isCentennialBattle ? `<div class="kassen-anniversary-badge kassen-centennial-badge">${t('kassenCentennialLabel', { count: battleNumber })}</div>` : ''}
      ${isAnniversaryBattle ? `<div class="kassen-anniversary-badge">${t('kassenAnniversaryLabel', { count: battleNumber })}</div>` : ''}
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

async function showDuelResult(winnerCard, points, isAnniversaryDuel, isCentennialDuel, battleNumber) {
  elements.duelResult.innerHTML = `
    <div class="kassen-result-card glass-card">
      <div class="kassen-result-badge">${t('duelResultBadge', { name: escapeHTML(winnerCard.name) })}</div>
      ${isCentennialDuel ? `<div class="kassen-anniversary-badge kassen-centennial-badge">${t('kassenCentennialLabel', { count: battleNumber })}</div>` : ''}
      ${isAnniversaryDuel ? `<div class="kassen-anniversary-badge">${t('kassenAnniversaryLabel', { count: battleNumber })}</div>` : ''}
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
  // まれに「必殺技」が発動し、一気に2つ押し込む。
  // 9回押し合っても決着がつかない場合、デュエルが長引きすぎないよう、
  // 10回目の代わりに「超奥義」で強制的に決着をつける
  let pushCount = 0;
  while (Math.abs(STATE.duel.netScore) < 3) {
    pushCount++;

    if (pushCount > 9) {
      elements.duelCommentaryText.textContent = t('duelFinalPhase');
      await duelSleep(1300);

      const direction = Math.random() < 0.5 ? 1 : -1;
      const actingCard = direction > 0 ? STATE.duel.left : STATE.duel.right;
      const ultimateTemplates = t('duelUltimateTemplates');
      const template = ultimateTemplates[Math.floor(Math.random() * ultimateTemplates.length)];
      elements.duelCommentaryText.textContent = template.replace(/\{name\}/g, actingCard.name);

      STATE.duel.netScore = direction * 3;
      STATE.duelUltimateMoveTriggered = true;
      updateMissionsGlow();
      updateDuelBar();
      await duelSleep(1300);
      break;
    }

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

  await showDuelResult(winnerCard, points, isAnniversaryDuel, isCentennialDuel, battleNumber);

  elements.btnDuelReselect.classList.remove('hidden');
  setDuelControlsDisabled(false);
  STATE.duel.inProgress = false;
}

// -------------------------------------------------------------
// DERBY MODE（ランダムに選ばれた6名が、競馬の枠番カラーで楕円コースを1周し、着順を競う）
// -------------------------------------------------------------

// 陸上競技場のトラックのような形（上下に直線、左右がカーブ）のコース座標系（SVG viewBox基準）
const DERBY_TRACK_CENTER = { cx: 150, cy: 100 };
const DERBY_STRAIGHT_HALF_LEN = 65; // 直線区間の中心からの長さ（左右のカーブ入口までの距離）
const DERBY_LANE_TURN_R_START = 28; // 1コース（内側）のカーブ半径
const DERBY_LANE_TURN_R_STEP = 10;  // コースが1つ外側に増えるごとのカーブ半径の増分（丸同士が重ならない間隔を確保）
// スタート地点：下の直線区間・中央よりやや右（中心からのオフセット）
const DERBY_START_OFFSET_X = 18;
const DERBY_DOT_RADIUS = 5;

const DERBY_TICK_MS = 100;
const DERBY_PROGRESS_MIN_STEP = 0.003;
const DERBY_PROGRESS_MAX_STEP = 0.011;

const DERBY_ROW_HEIGHT = 64;
const DERBY_ROW_GAP = 10;
const DERBY_ROW_STEP = DERBY_ROW_HEIGHT + DERBY_ROW_GAP;

// 着順ポイント（1着=3pt, 2着=2pt, 3着=1pt, 4着以下=0pt）
const DERBY_PLACEMENT_POINTS = [3, 2, 1];
// 記念大会（開催数が10または100の倍数）はポイント3倍
const DERBY_ANNIVERSARY_MULTIPLIER = 3;

function getCardDerbyPoints(card) {
  return card.derbyPoints || 0;
}

// 通常は着順ポイント（1着3pt/2着2pt/3着1pt）、記念大会（開催数が10・100の倍数）は3倍
function incrementCardDerbyPoints(card, points = 1) {
  card.derbyPoints = (card.derbyPoints || 0) + points;
}

function updateDerbyBattleCountDisplay() {
  elements.derbyBattleCount.textContent = t('derbyBattleCountLabel', { count: STATE.derbyBattleCount || 0 });
}

// 通算ポイントの降順（同ポイントなら登録年月が古い方、さらに同じならアルファベット順）でランキングを算出する。
// 未獲得（0pt）の名刺はランキング対象外で、上位20名まで表示する。
function getDerbyRanking() {
  return STATE.cards
    .filter(card => getCardDerbyPoints(card) >= 1)
    .slice()
    .sort((a, b) => {
      const countDiff = getCardDerbyPoints(b) - getCardDerbyPoints(a);
      if (countDiff !== 0) return countDiff;

      const monthA = getCardRegisteredMonth(a);
      const monthB = getCardRegisteredMonth(b);
      if (monthA !== monthB) return monthA.localeCompare(monthB);

      return (a.alphabet || '').localeCompare(b.alphabet || '', undefined, { sensitivity: 'base' });
    })
    .slice(0, 20);
}

function renderDerbyRanking() {
  const ranking = getDerbyRanking();

  if (ranking.length === 0) {
    elements.derbyRankingList.innerHTML = `<p class="kassen-ranking-empty">${t('derbyRankingEmpty')}</p>`;
    return;
  }

  elements.derbyRankingList.innerHTML = ranking.map((card, i) => {
    const rank = i + 1;
    return `
      <button type="button" class="kassen-ranking-item rank-${rank}" data-id="${card.id}">
        <span class="kassen-ranking-rank">${rank === 1 ? '<i data-lucide="crown"></i>' : rank}</span>
        <span class="kassen-ranking-info">
          <span class="kassen-ranking-name">${escapeHTML(card.name)}</span>
          <span class="kassen-ranking-alphabet">${escapeHTML(card.alphabet)}</span>
        </span>
        <span class="kassen-ranking-count">${t('derbyRankingCount', { count: getCardDerbyPoints(card) })}</span>
      </button>
    `;
  }).join('');
  lucide.createIcons();
}

// ダービーモード画面内の表示切り替え（'match' = レース画面, 'ranking' = ランキング）
function showDerbyView(view) {
  STATE.derbyView = view;
  const isRanking = view === 'ranking';

  elements.derbyRankingView.classList.toggle('hidden', !isRanking);
  elements.derbyMatch.classList.toggle('hidden', isRanking);

  if (isRanking) renderDerbyRanking();
  elements.btnDerbyRanking.classList.toggle('active', isRanking);
}

// 出走者候補から重複しない6枚をランダムに選ぶ
function pickSixRandomCards() {
  if (STATE.cards.length < 6) return null;
  const pool = STATE.cards.slice();
  const picked = [];
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

function getDerbyTurnRadius(laneIndex) {
  return DERBY_LANE_TURN_R_START + laneIndex * DERBY_LANE_TURN_R_STEP;
}

// 陸上トラック形（直線＋半円カーブ）の外周パスをSVGのd属性文字列として組み立てる
function buildDerbyStadiumPath(r, halfLen) {
  const { cx, cy } = DERBY_TRACK_CENTER;
  return [
    `M ${cx - halfLen} ${cy - r}`,
    `L ${cx + halfLen} ${cy - r}`,
    `A ${r} ${r} 0 0 1 ${cx + halfLen} ${cy + r}`,
    `L ${cx - halfLen} ${cy + r}`,
    `A ${r} ${r} 0 0 1 ${cx - halfLen} ${cy - r}`,
    'Z'
  ].join(' ');
}

// progress（0〜1＝1周分の進捗）とコース（レーン）から、コース上の座標を求める。
// 下直線（スタート地点）→右カーブ→上直線→左カーブ→下直線（スタート地点）の順に進む＝反時計回り
function getDerbyDotPosition(laneIndex, progress) {
  const r = getDerbyTurnRadius(laneIndex);
  const H = DERBY_STRAIGHT_HALF_LEN;
  const offsetX = DERBY_START_OFFSET_X;
  const { cx, cy } = DERBY_TRACK_CENTER;

  const segA = H - offsetX;  // 下直線：スタート地点→右下カーブ入口
  const segB = Math.PI * r;  // 右カーブ（半円）
  const segC = 2 * H;        // 上直線
  const segD = Math.PI * r;  // 左カーブ（半円）
  const segE = H + offsetX;  // 下直線：左下カーブ出口→スタート地点
  const total = segA + segB + segC + segD + segE;

  let s = (((progress % 1) + 1) % 1) * total;

  if (s < segA) {
    return { x: cx + offsetX + s, y: cy + r };
  }
  s -= segA;

  if (s < segB) {
    const angleDeg = 90 - (s / segB) * 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    return { x: cx + H + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
  }
  s -= segB;

  if (s < segC) {
    return { x: cx + H - s, y: cy - r };
  }
  s -= segC;

  if (s < segD) {
    const angleDeg = 270 - (s / segD) * 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    return { x: cx - H + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
  }
  s -= segD;

  return { x: cx - H + s, y: cy + r };
}

// 出走者の数（レーン数）分のトラック・スタートライン・ドットをまとめて描画する
// 見た目上、その出走者が現在どのレーン（横方向位置）を走っているかを返す（STATE.derby.lateralPosの動的な値）
function getDerbyEffectiveLane(i) {
  return STATE.derby.lateralPos[i] ?? i;
}

function renderDerbyTrack() {
  const cards = STATE.derby.cards;
  const lastLane = cards.length - 1;
  const outerR = getDerbyTurnRadius(lastLane);
  const innerR = getDerbyTurnRadius(0);
  const H = DERBY_STRAIGHT_HALF_LEN;

  const fieldPath = buildDerbyStadiumPath(innerR - 8, H - 12);
  const boundaryPath = buildDerbyStadiumPath(outerR + 9, H + 9);

  const startX = DERBY_TRACK_CENTER.cx + DERBY_START_OFFSET_X;
  const startY1 = DERBY_TRACK_CENTER.cy + innerR - 5;
  const startY2 = DERBY_TRACK_CENTER.cy + outerR + 5;

  const dotsSvg = cards.map((card, i) => {
    const pos = getDerbyDotPosition(getDerbyEffectiveLane(i), STATE.derby.progress[i] || 0);
    const finished = (STATE.derby.progress[i] || 0) >= 1;
    return `<circle id="derby-dot-${i}" class="derby-dot${finished ? ' hidden' : ''}" cx="${pos.x}" cy="${pos.y}" r="${DERBY_DOT_RADIUS}" style="fill:var(--gate-${i + 1}-bg);"/>`;
  }).join('');

  elements.derbyTrack.innerHTML = `
    <path class="derby-track-boundary" d="${boundaryPath}"/>
    <path class="derby-track-field" d="${fieldPath}"/>
    <line class="derby-start-line" x1="${startX}" y1="${startY1}" x2="${startX}" y2="${startY2}"/>
    ${dotsSvg}
  `;
}

// ゴールした（progress>=1）出走者の丸はコース上から非表示にする
function updateDerbyDotPositions() {
  STATE.derby.cards.forEach((_, i) => {
    const dot = document.getElementById(`derby-dot-${i}`);
    if (!dot) return;

    if (STATE.derby.progress[i] >= 1) {
      dot.classList.add('hidden');
      return;
    }

    const pos = getDerbyDotPosition(getDerbyEffectiveLane(i), STATE.derby.progress[i]);
    dot.setAttribute('cx', pos.x);
    dot.setAttribute('cy', pos.y);
  });
}

const DERBY_LATERAL_EASE_BUNCH = 0.07;  // 中盤（インコース寄せ）の目標レーンへの追従率
const DERBY_LATERAL_EASE_SPREAD = 0.18; // 最終直線の追従率（急激な動きで重なりが起きないよう抑えめに）
const DERBY_LATERAL_JITTER = 0.04;      // ランダムな揺らぎの強さ（自然な動きを出すため、ごく小さめ）
const DERBY_MIN_DOT_GAP_PX = DERBY_DOT_RADIUS * 2 + 4; // 丸同士が重ならないための最小距離（直径＋余白）
const DERBY_FINAL_STRETCH_THRESHOLD = 0.75; // 平均進捗がこれを超えたら「最終直線」演出に切り替え
// 順位（暫定順位）ごとに割り当てる目標レーンの間隔。レーン0〜5（出走6頭分）の範囲に必ず収まるよう、
// ちょうど1レーン分（＝隣接レーンが接する限界）にする。これより広げると6頭全員分の間隔がレーン範囲を
// はみ出し、目標地点そのものがトラック外になってしまう
const DERBY_SAFE_LANE_SPACING = 1;
const DERBY_SPREAD_LANE_SPACING = DERBY_SAFE_LANE_SPACING * 1.7;

// 各出走者の横方向の目標位置を決め、少しずつ近づける。
// 中盤までは暫定順位順に安全な最小間隔でインコースから並び、最終直線では順位順にさらに広い間隔で広がる。
// 目標位置自体が順位ごとに安全な間隔で決まるため、重なりはほぼ発生しない上、resolveDerbyDotOverlaps()が
// 遷移中の一時的な接近もカバーする。着順（勝敗）には一切影響しない、見た目だけの演出
function updateDerbyLateralTargets() {
  const progress = STATE.derby.progress;
  const avgProgress = progress.reduce((sum, p) => sum + p, 0) / progress.length;
  const isFinalStretch = avgProgress >= DERBY_FINAL_STRETCH_THRESHOLD;
  const ease = isFinalStretch ? DERBY_LATERAL_EASE_SPREAD : DERBY_LATERAL_EASE_BUNCH;
  const spacing = isFinalStretch ? DERBY_SPREAD_LANE_SPACING : DERBY_SAFE_LANE_SPACING;

  const ranking = progress
    .map((p, i) => ({ i, p }))
    .sort((a, b) => b.p - a.p);

  ranking.forEach(({ i }, rankIndex) => {
    if (progress[i] >= 1) return; // ゴール済みは動かさない

    const target = isFinalStretch ? STATE.derby.spreadTargets[i] : rankIndex * spacing;
    const pull = (target - STATE.derby.lateralPos[i]) * ease;
    const jitter = (Math.random() - 0.5) * DERBY_LATERAL_JITTER;
    STATE.derby.lateralPos[i] = Math.max(0, Math.min(5, STATE.derby.lateralPos[i] + pull + jitter));
  });

  resolveDerbyDotOverlaps();
}

// 実際の画面上の座標（2次元距離）を見て、丸同士が近づきすぎている場合は横方向位置（レーン）を
// 押し合って距離を離す。各反復で全ペアの補正量を一旦集計してから同時に適用することで
// （逐次適用だと後の補正が前の補正を打ち消し、収束しづらいことがあったため）、収束するまで反復する。
// レーン0〜5（トラック描画範囲）の外には押し出さない。内側・外側の壁として働くため、
// 詰まった場合は多少接近した状態のまま収まる（実際の競馬でも内柵より内側には出られない）
function resolveDerbyDotOverlaps() {
  const active = [];
  for (let i = 0; i < STATE.derby.cards.length; i++) {
    if (STATE.derby.progress[i] < 1) active.push(i);
  }
  const LANE_MIN = 0;
  const LANE_MAX = STATE.derby.cards.length - 1;

  for (let iter = 0; iter < 40; iter++) {
    const deltas = {};
    let anyPushed = false;

    for (let ai = 0; ai < active.length; ai++) {
      const a = active[ai];
      const posA = getDerbyDotPosition(STATE.derby.lateralPos[a], STATE.derby.progress[a]);
      for (let bi = ai + 1; bi < active.length; bi++) {
        const b = active[bi];
        const posB = getDerbyDotPosition(STATE.derby.lateralPos[b], STATE.derby.progress[b]);
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < DERBY_MIN_DOT_GAP_PX) {
          anyPushed = true;
          const neededPx = DERBY_MIN_DOT_GAP_PX - dist;
          const pushLateral = (neededPx / DERBY_LANE_TURN_R_STEP) * 0.5 + 0.03;
          const dir = STATE.derby.lateralPos[a] <= STATE.derby.lateralPos[b] ? 1 : -1;
          deltas[a] = (deltas[a] || 0) - dir * pushLateral;
          deltas[b] = (deltas[b] || 0) + dir * pushLateral;
        }
      }
    }

    if (!anyPushed) break;

    active.forEach(i => {
      if (deltas[i]) {
        STATE.derby.lateralPos[i] = Math.max(LANE_MIN, Math.min(LANE_MAX, STATE.derby.lateralPos[i] + deltas[i]));
      }
    });
  }

  // 上記の押し合いだけでは、複数組が同時に順位交代（レーンの交差）する場面などで
  // 6頭分の余裕を持った間隔（DERBY_MIN_DOT_GAP_PX）を全ペア分確保しきれないことがある
  // （必要な合計幅がレーン0〜5の幅を超えるため）。最後に順序どおり並べ直し、実際に丸が
  // 重ならない最低限の間隔（レーン1つ分＝直径分。隣接レーンが接する限界）だけは必ず確保する
  const MIN_LANE_GAP = 1;
  const order = active.slice().sort((x, y) => STATE.derby.lateralPos[x] - STATE.derby.lateralPos[y]);

  for (let i = 1; i < order.length; i++) {
    const prev = order[i - 1], cur = order[i];
    if (STATE.derby.lateralPos[cur] < STATE.derby.lateralPos[prev] + MIN_LANE_GAP) {
      STATE.derby.lateralPos[cur] = STATE.derby.lateralPos[prev] + MIN_LANE_GAP;
    }
  }
  if (order.length && STATE.derby.lateralPos[order[order.length - 1]] > LANE_MAX) {
    STATE.derby.lateralPos[order[order.length - 1]] = LANE_MAX;
    for (let i = order.length - 2; i >= 0; i--) {
      const next = order[i + 1], cur = order[i];
      if (STATE.derby.lateralPos[cur] > STATE.derby.lateralPos[next] - MIN_LANE_GAP) {
        STATE.derby.lateralPos[cur] = STATE.derby.lateralPos[next] - MIN_LANE_GAP;
      }
    }
  }
}

// 出走者配列をシャッフルしたインデックス順を返す（ゲート番号による偏りが出ないよう、Fisher-Yatesで公平に）
function shuffleDerbyIndices(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 現在の進捗（周回率）順に、出走者一覧の各行の表示位置（top）と現在順位を更新する。
// ゴール済み（progress>=1）の出走者同士は進捗が同値（1）になるため、実際にゴールした順（finishOrder）で順位を付け、
// レース中の出走者はまだゴールしていない者より必ず下位とした上で、進捗が大きい順に暫定順位とする
function updateDerbyRaceListOrder() {
  const progress = STATE.derby.progress;
  const finishOrder = STATE.derby.finishOrder;
  const order = progress.map((_, i) => i).sort((a, b) => {
    const finishedA = progress[a] >= 1;
    const finishedB = progress[b] >= 1;
    if (finishedA && finishedB) return finishOrder.indexOf(a) - finishOrder.indexOf(b);
    if (finishedA !== finishedB) return finishedA ? -1 : 1;
    if (progress[b] !== progress[a]) return progress[b] - progress[a];
    return a - b;
  });
  order.forEach((gateIndex, rank) => {
    const row = document.getElementById(`derby-race-row-${gateIndex}`);
    if (row) row.style.top = `${rank * DERBY_ROW_STEP}px`;

    const rankLabel = document.getElementById(`derby-rank-${gateIndex}`);
    if (!rankLabel) return;

    // 1着がゴール済みの場合のみ、「1」を王冠アイコンに置き換える（レース中の暫定首位はまだ王冠にしない）
    const isConfirmedWinner = rank === 0 && progress[gateIndex] >= 1;
    if (isConfirmedWinner) {
      if (rankLabel.dataset.crown !== '1') {
        rankLabel.innerHTML = '<i data-lucide="crown"></i>';
        rankLabel.dataset.crown = '1';
        lucide.createIcons();
      }
    } else {
      if (rankLabel.dataset.crown === '1') delete rankLabel.dataset.crown;
      rankLabel.textContent = rank + 1;
    }
  });
}

async function renderDerbyLineup() {
  const cards = STATE.derby.cards;
  elements.derbyLineup.style.height = `${cards.length * DERBY_ROW_STEP - DERBY_ROW_GAP}px`;
  elements.derbyLineup.innerHTML = cards.map((card, i) => `
    <div class="derby-entry derby-gate-${i + 1}" id="derby-race-row-${i}" style="top:${i * DERBY_ROW_STEP}px">
      <div class="derby-rank" id="derby-rank-${i}">${i + 1}</div>
      <div class="derby-gate-badge">${i + 1}</div>
      <div class="derby-entry-image-wrapper" id="derby-entry-image-${i}"><i data-lucide="user"></i></div>
      <div class="derby-entry-info">
        <div class="derby-entry-name">${escapeHTML(card.name)}</div>
        <div class="derby-entry-alphabet">${escapeHTML(card.alphabet)}</div>
      </div>
      <span class="kassen-ranking-count" id="derby-points-${i}"></span>
    </div>
  `).join('');
  lucide.createIcons();

  await Promise.all(cards.map(async (card, i) => {
    if (!card.imageId) return;
    const imageUrl = await fetchCardImage(card.imageId);
    if (imageUrl) {
      const imageWrapper = document.getElementById(`derby-entry-image-${i}`);
      if (imageWrapper) imageWrapper.innerHTML = `<img src="${imageUrl}" alt="${escapeHTML(card.name)}">`;
    }
  }));
}

function drawDerbyLineup() {
  const picked = pickSixRandomCards();
  STATE.derby.cards = picked || [];
  STATE.derby.progress = picked ? picked.map(() => 0) : [];
  STATE.derby.finishOrder = [];
  STATE.derby.racing = false;
  // lateralPosは自分のゲート番号（＝インコースからの並び順）からスタート。
  // spreadTargetsは、最終直線で広がる際の目標レーンをレースごとにランダムに割り当てる
  // （Fisher-Yatesでシャッフルするため、ゲート番号による有利不利は生まれない）
  STATE.derby.lateralPos = picked ? picked.map((_, i) => i) : [];
  STATE.derby.spreadTargets = picked ? shuffleDerbyIndices(picked.length) : [];

  const notEnough = !picked;
  elements.derbyEmptyState.classList.toggle('hidden', !notEnough);
  elements.derbyTrackWrapper.classList.toggle('hidden', notEnough);
  elements.derbyLineup.classList.toggle('hidden', notEnough);
  elements.btnStartDerby.classList.toggle('hidden', notEnough);
  elements.btnDerbyReselect.classList.toggle('hidden', notEnough);
  elements.derbyCommentary.classList.add('hidden');
  elements.derbyCommentaryText.textContent = '';
  elements.derbyBonusBadge.classList.add('hidden');
  elements.derbyBonusBadge.innerHTML = '';

  if (picked) {
    elements.btnStartDerby.disabled = false;
    renderDerbyTrack();
    renderDerbyLineup();
  }
}

function openDerbyMode() {
  showScreen('screen-derby');
  showDerbyView('match');
  updateDerbyBattleCountDisplay();
  drawDerbyLineup();
}

// コースを進行方向に4等分したときの区切り（0.25刻み）。いずれかの出走者がその区切りを
// 通過するたびに、その時点の先頭（トップ）を実況する
const DERBY_ZONE_THRESHOLDS = [0.25, 0.5, 0.75];
const DERBY_ZONE_COMMENT_KEYS = ['derbyZone1Comment', 'derbyZone2Comment', 'derbyZone3Comment'];

// 現在最も進捗が進んでいる（トップの）出走者を返す
function getDerbyLeaderCard() {
  const progress = STATE.derby.progress;
  const leaderIndex = progress.reduce((best, p, i) => (p > progress[best] ? i : best), 0);
  return STATE.derby.cards[leaderIndex];
}

// レース開始。「レーススタート！」表示から1.3秒後に走行を開始し、tickごとに各出走者の進捗を
// ランダムに進める。コースを4等分した区切りを誰かが通過するたびにその時のトップを実況し、
// 1周（progress>=1）した順に着順が決まる。出走者一覧は進捗順に行のtopを書き換えて順位変動をアニメーションさせる
async function startDerbyRace() {
  if (STATE.derby.racing || STATE.derby.cards.length < 6) return;
  if (STATE.derby.finishOrder.length === STATE.derby.cards.length) return; // 既に完走済み

  STATE.derby.racing = true;
  elements.btnStartDerby.disabled = true;
  elements.btnDerbyReselect.classList.add('hidden');

  if (elements.derbyScreenContent) {
    elements.derbyScreenContent.scrollTo({ top: 0, behavior: 'smooth' });
  }
  elements.derbyCommentary.classList.remove('hidden');
  elements.derbyCommentaryText.textContent = t('derbyStartMessage');
  await duelSleep(1300);

  // これまでの開催数をカウント。10または100の倍数は「記念大会」でポイント3倍
  STATE.derbyBattleCount = (STATE.derbyBattleCount || 0) + 1;
  const battleNumber = STATE.derbyBattleCount;
  const isCentennialDerby = battleNumber % 100 === 0;
  const isAnniversaryDerby = !isCentennialDerby && battleNumber % 10 === 0;
  updateDerbyBattleCountDisplay();

  let nextZoneIndex = 0;

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      // 同じtick内で複数の出走者が同時にゴールラインを超えることがあるため、
      // ゲート番号（配列の並び順）でそのまま着順を決めると若い番号が常に有利になってしまう。
      // そこで一旦クランプ前の生の進捗（1を超えた分）を記録し、超過が大きい＝より先に
      // ゴールしたとみなして着順を決める
      const newlyFinished = [];
      STATE.derby.cards.forEach((_, i) => {
        if (STATE.derby.progress[i] >= 1) return;
        const step = DERBY_PROGRESS_MIN_STEP + Math.random() * (DERBY_PROGRESS_MAX_STEP - DERBY_PROGRESS_MIN_STEP);
        const rawProgress = STATE.derby.progress[i] + step;
        STATE.derby.progress[i] = Math.min(1, rawProgress);
        if (rawProgress >= 1) {
          newlyFinished.push({ i, rawProgress });
        }
      });
      newlyFinished
        .sort((a, b) => b.rawProgress - a.rawProgress)
        .forEach(({ i }) => {
          if (!STATE.derby.finishOrder.includes(i)) {
            STATE.derby.finishOrder.push(i);
          }
        });

      updateDerbyLateralTargets();
      updateDerbyDotPositions();
      updateDerbyRaceListOrder();

      while (
        nextZoneIndex < DERBY_ZONE_THRESHOLDS.length &&
        STATE.derby.progress.some(p => p >= DERBY_ZONE_THRESHOLDS[nextZoneIndex])
      ) {
        const leaderCard = getDerbyLeaderCard();
        elements.derbyCommentaryText.textContent = t(DERBY_ZONE_COMMENT_KEYS[nextZoneIndex], { name: leaderCard.name });
        nextZoneIndex++;
      }

      if (STATE.derby.progress.every(p => p >= 1)) {
        clearInterval(timer);
        resolve();
      }
    }, DERBY_TICK_MS);
  });

  const isBonusDerby = isAnniversaryDerby || isCentennialDerby;
  const multiplier = isBonusDerby ? DERBY_ANNIVERSARY_MULTIPLIER : 1;
  STATE.derby.finishOrder.slice(0, 3).forEach((gateIndex, i) => {
    const card = STATE.derby.cards[gateIndex];
    const points = DERBY_PLACEMENT_POINTS[i] * multiplier;
    incrementCardDerbyPoints(card, points);

    const pointsEl = document.getElementById(`derby-points-${gateIndex}`);
    if (pointsEl) {
      pointsEl.textContent = `+${points}pt`;
      pointsEl.classList.toggle('kassen-mvp-points-bonus', isBonusDerby);
    }
  });
  saveMetadata().catch(err => console.error('ダービー結果の保存に失敗しました:', err));
  if (STATE.derbyView === 'ranking') renderDerbyRanking();

  const winnerCard = STATE.derby.cards[STATE.derby.finishOrder[0]];
  const winnerTemplates = t('derbyWinnerTemplates');
  const winnerTemplate = winnerTemplates[Math.floor(Math.random() * winnerTemplates.length)];
  elements.derbyCommentaryText.textContent = winnerTemplate.replace(/\{name\}/g, winnerCard.name);

  // 記念大会ボーナスは、他モード同様ポップアップ（トースト）ではなく、
  // 出走者再抽選ボタンと1着の間にバッジとして表示する
  if (isCentennialDerby) {
    elements.derbyBonusBadge.innerHTML = `<div class="kassen-anniversary-badge kassen-centennial-badge">${t('kassenCentennialLabel', { count: battleNumber })}</div>`;
    elements.derbyBonusBadge.classList.remove('hidden');
  } else if (isAnniversaryDerby) {
    elements.derbyBonusBadge.innerHTML = `<div class="kassen-anniversary-badge">${t('kassenAnniversaryLabel', { count: battleNumber })}</div>`;
    elements.derbyBonusBadge.classList.remove('hidden');
  }

  STATE.derby.racing = false;
  elements.btnDerbyReselect.classList.remove('hidden');
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
