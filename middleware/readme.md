middlewareはExpress の request/response を中継するものだよ。
req,res,nextを引数にとって、最後にnextを実行する関数はここに分離できるよ。