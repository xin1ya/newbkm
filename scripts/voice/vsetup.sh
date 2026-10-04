pip install -q vosk pypinyin imageio-ffmpeg 2>&1 | grep -v notice
mkdir -p ~/bin ~/.cache && ln -sf $(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") ~/bin/ffmpeg
cd ~/.cache && (test -d vosk-model-small-cn-0.22 || (curl -sL -o m.zip https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip && python3 -c "import zipfile;zipfile.ZipFile('m.zip').extractall('.')" && rm m.zip))
