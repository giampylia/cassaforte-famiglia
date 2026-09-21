/**
 * Mini QRCode SVG Generator (Zero-Dependency, 100% Offline)
 * Genera un SVG del QR Code direttamente in memoria
 */
(function(window) {
  // Implementazione compatta QR Code Type 3 / 4 con correzione errori L/M
  // Utilizziamo una versione minimale e robusta per stringhe URL fino a 50 caratteri
  
  function QR8bitByte(data) {
    this.mode = 4;
    this.data = data;
  }
  QR8bitByte.prototype = {
    getLength: function() { return this.data.length; },
    write: function(buffer) {
      for (var i = 0; i < this.data.length; i++) {
        buffer.put(this.data.charCodeAt(i), 8);
      }
    }
  };

  function QRCode(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }

  QRCode.prototype = {
    addData: function(data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    },
    isDark: function(row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return this.modules[row][col];
    },
    getModuleCount: function() { return this.moduleCount; },
    make: function() {
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (var col = 0; col < this.moduleCount; col++) {
          this.modules[row][col] = null;
        }
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) { this.setupTypeNumber(test); }
      if (this.dataCache == null) {
        this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      }
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern: function(row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
              (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
              (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    setupTimingPattern: function() {
      for (var r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] != null) continue;
        this.modules[r][6] = (r % 2 == 0);
      }
      for (var c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] != null) continue;
        this.modules[6][c] = (c % 2 == 0);
      }
    },
    setupTypeInfo: function(test, maskPattern) {
      var data = (this.errorCorrectLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;

        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = !test;
    },
    setupTypeNumber: function(test) {
      var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      for (var i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    },
    mapData: function(data, maskPattern) {
      var inc = -1;
      var row = this.moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] == null) {
              var dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
              }
              var mask = QRUtil.getMask(maskPattern, row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex == -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    },
    getBestMaskPattern: function() {
      var minLostPoint = 0;
      var pattern = 0;
      for (var i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        var lostPoint = QRUtil.getLostPoint(this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    },
    createSvgTag: function(cellSize, margin) {
      cellSize = cellSize || 4;
      margin = margin || 2;
      var size = this.getModuleCount();
      var fullSize = (size + margin * 2) * cellSize;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + fullSize + ' ' + fullSize + '" width="100%" height="100%">';
      svg += '<rect width="100%" height="100%" fill="#ffffff" rx="12"/>';
      svg += '<g fill="#2d4a43">';
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          if (this.isDark(r, c)) {
            var x = (c + margin) * cellSize;
            var y = (r + margin) * cellSize;
            svg += '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" rx="1"/>';
          }
        }
      }
      svg += '</g></svg>';
      return svg;
    }
  };

  // Funzioni di supporto matematico QR
  var QRMode = { MODE_NUMBER: 1, MODE_ALPHA_NUM: 2, MODE_8BIT_BYTE: 4 };
  var QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
  var QRMaskPattern = {
    PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3,
    PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7
  };

  var QRUtil = {
    PATTERN_POSITION_TABLE: [
      [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
    ],
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
    getBCHTypeInfo: function(data) {
      var d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
        d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
      }
      return ((data << 10) | d) ^ QRUtil.G15_MASK;
    },
    getBCHTypeNumber: function(data) {
      var d = data << 12;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
        d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
      }
      return (data << 12) | d;
    },
    getBCHDigit: function(data) {
      var digit = 0;
      while (data != 0) { digit++; data >>>= 1; }
      return digit;
    },
    getMask: function(maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 == 0;
        case 1: return i % 2 == 0;
        case 2: return j % 3 == 0;
        case 3: return (i + j) % 3 == 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        case 5: return (i * j) % 2 + (i * j) % 3 == 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    },
    getErrorCorrectPolynomial: function(errorCorrectLength) {
      var a = new QRPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    },
    getLengthInBits: function(mode, type) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case 1: return 10;
          case 2: return 9;
          case 4: return 8;
        }
      }
      return 8;
    },
    getLostPoint: function(qrCode) {
      var moduleCount = qrCode.getModuleCount();
      var lostPoint = 0;
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0;
          var dark = qrCode.isDark(row, col);
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r == 0 && c == 0) continue;
              if (dark == qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      return lostPoint;
    }
  };

  var QRMath = {
    glog: function(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 255) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };

  for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (var i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function QRPolynomial(num, shift) {
    if (num.length == undefined) throw new Error(num.length + "/" + shift);
    var offset = 0;
    while (offset < num.length && num[offset] == 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }

  QRPolynomial.prototype = {
    get: function(index) { return this.num[index]; },
    getLength: function() { return this.num.length; },
    multiply: function(e) {
      var num = new Array(this.getLength() + e.getLength() - 1);
      for (var i = 0; i < this.getLength(); i++) {
        for (var j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      var num = new Array(this.getLength());
      for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (var i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  function QRRSBlock(totalCount, dataCount) {
    this.totalCount = totalCount;
    this.dataCount = dataCount;
  }
  QRRSBlock.RS_BLOCK_TABLE = [
    [1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80]
  ];
  QRRSBlock.getRSBlocks = function(typeNumber) {
    var rsBlock = QRRSBlock.RS_BLOCK_TABLE[typeNumber - 1];
    var list = [];
    for (var i = 0; i < rsBlock[0]; i++) {
      list.push(new QRRSBlock(rsBlock[1], rsBlock[2]));
    }
    return list;
  };

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype = {
    get: function(index) {
      var bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1;
    },
    put: function(num, length) {
      for (var i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) == 1);
      }
    },
    putBit: function(bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
    var rsBlocks = QRRSBlock.getRSBlocks(typeNumber);
    var buffer = new QRBitBuffer();
    for (var i = 0; i < dataList.length; i++) {
      var data = dataList[i];
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
      data.write(buffer);
    }
    var totalDataCount = 0;
    for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.length % 8 != 0) buffer.putBit(false);
    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0xEC, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }

    var bytes = [];
    for (var i = 0; i < buffer.length / 8; i++) {
      var b = 0;
      for (var j = 0; j < 8; j++) {
        if (buffer.get(i * 8 + j)) b |= (1 << (7 - j));
      }
      bytes.push(b);
    }

    var ecPoly = QRUtil.getErrorCorrectPolynomial(rsBlocks[0].totalCount - rsBlocks[0].dataCount);
    var rawPoly = new QRPolynomial(bytes, ecPoly.getLength() - 1);
    var modPoly = rawPoly.mod(ecPoly);
    var ecBytes = [];
    for (var i = 0; i < ecPoly.getLength() - 1; i++) {
      var modIndex = i + modPoly.getLength() - (ecPoly.getLength() - 1);
      ecBytes.push((modIndex >= 0) ? modPoly.get(modIndex) : 0);
    }

    return bytes.concat(ecBytes);
  };

  // Esporta funzione globale per generare SVG
  window.generateQrCodeSvg = function(text) {
    try {
      // Type 3 supporta fino a 55 caratteri (perfetto per http://192.168.1.8:3002)
      var qr = new QRCode(3, 1);
      qr.addData(text);
      qr.make();
      return qr.createSvgTag(6, 3);
    } catch (e) {
      console.error('Errore creazione QR:', e);
      return '<div style="padding:20px; color:#2d4a43; font-family:sans-serif;">Apri dal cellulare:<br><strong>' + text + '</strong></div>';
    }
  };

})(window);
