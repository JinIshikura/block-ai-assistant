# テスト（開発用）

node と jsdom、scratch-vm を使う。`learn-vm-test.js` は、課題（course.json）ごとに「正しいコードは合格・最初のコードは不合格」になるかを、本物のScratchのしくみ（scratch-vm）で確かめる。触れる判定（touching）は node では確かめられないので、実機で確認する。
