  for x in `ls -Sr data/*/perf.data.tar.gz`; do
      echo $x;
      Y=$(dirname "${x}")
      echo $Y
      pushd $Y
      tar -xzf perf.data.tar.gz
      find \*.log -exec bash -c "eval node --prof-process {} > {}.perf.txt" \;
      popd
      #echo "tar -vC ./tmp/results/ -xzf $x "
  done
